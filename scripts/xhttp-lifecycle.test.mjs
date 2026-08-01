import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Reported symptom: the tunnel feels unstable with connection drops, most often in XHTTP.
// Two XHTTP-specific lifecycle defects explain exactly that, and both were reproduced by external review:
//
//   1. A post-authentication failure (dial refused, upstream reset, write failure) called the bridge's
//      GRACEFUL close, which ends the already-sent HTTP 200 with a clean EOF. The client sees a
//      successful — usually empty — response, so it neither retries nor reports an error. To a user that
//      is a page that silently fails or a connection that "drops".
//   2. UDP/DNS mode has no remote read pipe to end the downstream, and the upstream-close block was
//      gated on `!首包.isUDP`. So a finite DNS request delivered its answer and then left the response
//      stream open until the client timed out.
//
// These assertions are structural because driving the real ReadableStream needs the Workers runtime;
// what they pin is that the two paths are DISTINCT and that the failure path errors rather than closes.
const BUILDS = ['_worker_copypaste.js', 'wrangler_deploy_method_worker/_worker.js', 'src_static_ui/worker_test.js'];

for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');

	// The bridge must expose BOTH a graceful close and a failing close.
	assert.match(src, /\t*close\(\) \{[\s\S]{0,600}?try \{ controller\.close\(\) \} catch/,
		`${file}: the XHTTP bridge must keep a graceful close()`);
	assert.match(src, /fail\(error\) \{/, `${file}: the XHTTP bridge must expose fail(error)`);
	assert.match(src, /controller\.error\(error instanceof Error \? error : new Error\(/,
		`${file}: fail() must call controller.error(), not controller.close()`);

	// The forwarding catch must route a post-auth failure to fail(), while a client-initiated
	// cancellation still closes quietly (that is not a tunnel failure and must not surface as one).
	assert.match(src, /if \(是流取消错误\(err\) \|\| remoteConnWrapper\.客户端已关闭\) closeSocketQuietly\(xhttpBridge\);\s*\n\s*else xhttpBridge\.fail\(err\);/,
		`${file}: a post-auth XHTTP failure must error the stream; only cancellation may close cleanly`);

	// UDP/DNS must terminate the response at request EOF, and must not end cleanly on a partial frame.
	assert.match(src, /XHTTP ended with an incomplete UDP frame/,
		`${file}: an incomplete trailing UDP frame must be an error, not a clean end`);
	assert.match(src, /const 未完帧 = \(首包\.协议 === 'trojan' \? 木马UDP上下文 : 魏烈思UDP上下文\)\?\.缓存;[\s\S]{0,300}?closeSocketQuietly\(xhttpBridge\);/,
		`${file}: XHTTP UDP mode must close the response stream once every complete frame is answered`);

	// A failing close is useless if a LOWER layer already closed the transport gracefully: the bridge sets
	// 已关闭, and the outer catch's fail() becomes a no-op. That is why a dial failure, a steady-state write
	// failure and a remote read error all still reached the client as a clean, successful, empty EOF even
	// after fail() existed. Every layer that ends a connection because something FAILED must say so.
	assert.match(src, /function failClientTransportQuietly/, `${file}: a failure-aware transport terminator must exist`);
	assert.match(src, /return closeSocketQuietly\(transport, 1011\)/,
		`${file}: WS has no fail(); it must close 1011 (unexpected condition), not the default 1000`);

	// 1. Upload-queue write failures. The queue passes its error to 关闭连接; that error must be honoured.
	assert.match(src, /关闭连接: \(错误\) => \{[\s\S]{0,400}?failClientTransportQuietly\(xhttpBridge, 错误\)/,
		`${file}: an upload-queue write failure must fail the XHTTP stream, not close it gracefully`);

	// 2. Dial failures inside forwardataTCP that close the client transport and then rethrow.
	assert.match(src, /failClientTransportQuietly\(ws, new Error\('ProxyIP attempts failed and fallback is disabled'\)\)/,
		`${file}: exhausted ProxyIP with fallback disabled must fail the transport`);
	assert.match(src, /if \(!可重放首包\) \{ failClientTransportQuietly\(ws, err\); throw err; \}/,
		`${file}: a non-replayable first-packet failure must fail the transport`);

	// 3. Remote READ errors. This catch was the only layer that saw them, and it swallowed the rejection.
	assert.match(src, /else failClientTransportQuietly\(webSocket, error\);/,
		`${file}: a remote-read failure must fail the client transport`);
	assert.match(src, /const 是正常收尾 = 是流取消错误\(error\) \|\| pipeMeta\?\.wrapper\?\.客户端已关闭;/,
		`${file}: client cancellation and our own teardown must still be treated as normal`);
	assert.match(src, /if \(是正常收尾\) closeSocketQuietly\(webSocket\);/,
		`${file}: normal teardown must still close quietly, not report a failure`);

	// connectStreams sits UPSTREAM of pipeRemoteToClient, so pre-closing there defeated the fix below it:
	// the bridge set 已关闭 and every downstream fail() became a no-op. This is the layer that KNOWS the
	// remote read or the fallback failed, so it must be the layer that says so.
	assert.doesNotMatch(src, /closeSocketQuietly\(webSocket\);\s*\n\s*throw/,
		`${file}: connectStreams must not close the client gracefully before rethrowing a failure`);
	assert.match(src, /failClientTransportQuietly\(webSocket, retryError\);\s*\n\s*throw retryError;/,
		`${file}: a failed fallback dial must fail the transport`);
	assert.match(src, /failClientTransportQuietly\(webSocket, readError\);\s*\n\s*throw readError;/,
		`${file}: a remote-read failure must fail the transport`);

	// The remote socket must be reclaimed on a mid-stream failure too. `if (!hasData) closeRemoteSocketQuietly`
	// skips it once bytes have flowed, which left the remote open and relied on the CLIENT's teardown handler
	// firing to clean up — impossible when the close is the one we just initiated ourselves. On the free plan
	// that orphans one of 6 concurrent connection slots per occurrence.
	assert.match(src, /closeRemoteSocketQuietly\(remoteSocket\);\s*\n\s*failClientTransportQuietly\(webSocket, readError\);/,
		`${file}: a mid-stream read failure must close the remote socket, not leak it`);

	// A watchdog cancels the reader, so read() can resolve done=true and leave readError null. The cause must
	// therefore be recorded by whoever CAUSED it, not reconstructed afterwards from hasData/closeHint.
	// The reconstruction was wrong in both directions and both are regression-guarded here:
	//   - it required !hasData, but the idle watchdog only arms AFTER the first byte, so its branch was dead
	//     and an IDLE_TIMEOUT_MS-killed mid-stream stall ended as a clean successful EOF;
	//   - it turned EVERY no-data EOF into an error, which breaks TCP relay transparency for a peer that
	//     legitimately accepts a request and closes without replying.
	assert.match(src, /设置终止错误\(new Error\('remote first-byte timeout'\)\);\s+cancelReaderQuietly/,
		`${file}: the first-byte watchdog must record its own cause before cancelling the reader`);
	assert.match(src, /设置终止错误\(new Error\('remote idle timeout'\)\);\s+cancelReaderQuietly/,
		`${file}: the idle watchdog must record its own cause — its old branch was unreachable`);
	assert.match(src, /if \(!客户端已关闭 && 终止错误\) \{[\s\S]{0,300}?failClientTransportQuietly\(webSocket, 终止错误\);\s+throw 终止错误;/,
		`${file}: a DETECTED failure must error the client`);
	assert.doesNotMatch(src, /remote closed before returning a response/,
		`${file}: a bare remote FIN must stay a FIN, not be synthesised into an error`);

	// Protocol/parser defects found alongside the lifecycle work.
	// THREE parsers exist for this header: the shared accumulator, XHTTP's private copy, and the complete
	// parser. The first fix landed only in the shared one, so XHTTP -- the transport with the reported
	// problems -- still accepted version 1 and 255. Assert all three until the duplication is removed.
	assert.match(src, /if \(data\[0\] !== 0\) return \{ 状态: 'invalid', 原因: `unsupported 魏烈思 version \$\{data\[0\]\}` \};/,
		`${file}: shared accumulator must reject a nonzero version`);
	assert.match(src, /const 尝试解析魏烈思首包 = \(data\) => \{[\s\S]{0,500}?if \(data\[0\] !== 0\) return \{ 状态: 'invalid' \};/,
		`${file}: XHTTP's private parser must reject a nonzero version too`);
	assert.match(src, /if \(version !== 0\) return \{ hasError: true, message: `Unsupported version: \$\{version\}` \};/,
		`${file}: the complete parser must reject a nonzero version too`);

	// A module global outlives the request that created it, so a live promise parked in one and awaited by a
	// LATER request is cross-request I/O -- the runtime rejects it and that request's dial fails for a reason
	// nothing in it can explain. Only completed, serializable records may be cached at module scope.
	assert.doesNotMatch(src, /PROXY_RESOLUTION_IN_FLIGHT/,
		`${file}: no module-global map may hold a live resolution promise across requests`);
	assert.doesNotMatch(src, /\(\(payload\[0\] << 8\) \| payload\[1\]\) !== payload\.byteLength - 2/,
		`${file}: a 木马 DNS datagram's first 2 bytes are its transaction ID, never a TCP length prefix`);
	assert.match(src, /let WS内层认证完成 = false;/, `${file}: protocol selection is not authentication`);
	assert.match(src, /if \(WS内层认证完成 \|\| isDnsQuery\) return; \/\/ already authenticated/,
		`${file}: the pre-auth deadline must key on real authentication, not on '?enc=' selecting ss`);

	// Buffered downlink bytes must survive a read error. flush() used to be the last statement INSIDE the
	// read try, so an error skipped it and a small response fragment was silently discarded.
	assert.match(src, /\} catch \(err\) \{ readError = err \}[\s\S]{0,1400}?try \{ await 下行发送器\.flush\(\); \}[\s\S]{0,120}?catch \(flushErr\) \{ if \(!readError\) readError = flushErr; \}/,
		`${file}: the final flush must run outside the read try, so accepted bytes are not lost on error`);

	// The SAME bug existed on the gRPC path, which is the default transport here — so it was the widest-reaching
	// instance of it. The bridge had no fail(), so failClientTransportQuietly fell through to close(), and
	// 关闭连接() ran controller.close() from a finally whose catch swallowed the error without rethrowing. Every
	// post-auth gRPC failure therefore ended as a clean, successful, empty response.
	assert.match(src, /const 关闭连接 = \(错误\) => \{/, `${file}: 关闭连接 must be able to report a failure`);
	assert.match(src, /if \(错误\) \{ try \{ controller\.error\(错误 instanceof Error \? 错误 : new Error\(String\(错误 \|\| 'gRPC forwarding failed'\)\)\) \} catch \(e\) \{ \} \}\s*\n\s*else \{ try \{ controller\.close\(\) \} catch \(e\) \{ \} \}/,
		`${file}: a gRPC failure must error the response; only a clean end may close it`);
	assert.match(src, /if \(!是流取消错误\(err\) && !remoteConnWrapper\.客户端已关闭\) 关闭原因 = err;/,
		`${file}: the swallowed gRPC error must reach the finally, and cancellation must stay a clean close`);
	assert.match(src, /关闭连接\(关闭原因\);/, `${file}: the gRPC finally must pass the failure through`);
	assert.match(src, /new Error\(String\(error \|\| 'gRPC forwarding failed'\)\)/, `${file}: the gRPC bridge needs fail()`);
	// fail() drains before erroring so the ordering is right for whatever the runtime has already pulled.
	// It is NOT a delivery guarantee: controller.error() resets the queue, so an undelivered tail is lost
	// either way. The comment in the source says so explicitly — this only pins the ordering.
	assert.match(src, /fail\(error\) \{[\s\S]{0,1400}?刷新发送队列\(true\);/,
		`${file}: gRPC fail() must drain before erroring`);
	assert.match(src, /Do not add work here on the belief that it preserves data\./,
		`${file}: the source must not re-acquire the false belief that flushing rescues the queued tail`);

	// 'grpc-status' in the INITIAL header block is a Trailers-Only response: the RPC is already complete with
	// that status and has no body. Announcing status 0 up front told a conforming client the call had already
	// succeeded, which both contradicts a tunnel that has sent nothing yet and licences a client to disregard
	// the controller.error() the layers above now rely on.
	// Matches the header-property form ('grpc-status':) so the prose explaining its removal doesn't trip it.
	assert.doesNotMatch(src, /'grpc-status':/, `${file}: grpc-status must not be sent in the initial headers`);
	assert.match(src, /'Content-Type': 'application\/grpc'/, `${file}: the gRPC content type must remain`);

	// Regression guard: the old shape must not come back.
	assert.doesNotMatch(src, /if \(!是流取消错误\(error\) && !\(pipeMeta\?\.wrapper\?\.客户端已关闭\)\) log\(`\[Stream pipe\][^\n]*\n\s*closeSocketQuietly\(webSocket\);/,
		`${file}: the remote-read catch is swallowing failures again`);
	assert.doesNotMatch(src, /关闭连接全部Socket\(remoteConnWrapper\); \/\/ close the upstream too \(WS\/gRPC already do\)\n\s*closeSocketQuietly\(xhttpBridge\);\n\s*\} finally/,
		`${file}: the unconditional graceful close on the failure path is back`);
}

// A SCHEDULED grain flush runs detached from whoever queued the bytes, so its rejection has no caller to
// return to. It was handled with `.catch(() => closeSocketQuietly(webSocket))`: the client got a NORMAL 1000
// close and the operation RESOLVED, so a downstream send that genuinely failed looked exactly like a stream
// that finished cleanly and connectStreams never learned the bytes were undelivered. Fifth home of the same
// failure-as-success class, and the only one where the failure is ownerless by construction.
// Driven for real rather than asserted structurally, because the bug lives in the asynchronous path.
{
	const { __testPerformanceHelpers: H } = await import('../_worker_copypaste.js');
	let ownerErr = null;
	const closes = [];
	const ws = {
		readyState: 1, bufferedAmount: 0,
		send() { return Promise.reject(new Error('DOWNSTREAM_SEND_FAILED')); },
		close(code) { closes.push(code ?? null); this.readyState = 3; },
		addEventListener() { }, removeEventListener() { },
	};
	const sender = H.创建下行Grain发送器(ws, null, 65536, null, (e) => { ownerErr = e; });
	// Three bytes take the small-tail SCHEDULED path rather than an inline await — that is the whole point.
	await sender.发送(new Uint8Array([9, 8, 7]));
	await new Promise(r => setTimeout(r, 30));

	assert.ok(ownerErr, 'a scheduled flush rejection must reach the pipe that owns the stream');
	assert.match(ownerErr.message, /DOWNSTREAM_SEND_FAILED/, 'the original cause must survive');
	await assert.rejects(() => sender.flush(), /DOWNSTREAM_SEND_FAILED/,
		'flush() must report a failure a scheduled flush already recorded, not resolve as if the tail went out');
	await assert.rejects(() => sender.发送(new Uint8Array([1])), /DOWNSTREAM_SEND_FAILED/,
		'sending after a terminal failure must not silently succeed');
	assert.deepEqual(closes, [],
		'the sender must not close the client itself — closing 1000 here is what disguised the failure as a clean finish');
}

for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');
	assert.doesNotMatch(src, /flush\(\)\.catch\(\(\) => closeSocketQuietly\(webSocket\)\)/,
		`${file}: a scheduled flush must not swallow its rejection into a clean close`);
	assert.match(src, /cancelReaderQuietly\(reader, 'downstream send failed'\)/,
		`${file}: connectStreams must own the grain sender's asynchronous failure`);
}

console.log('xhttp lifecycle tests passed');
