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

	// A watchdog cancels the reader, so read() can resolve done=true and leave readError null. "We sent a
	// request and got nothing back" is a failure; reporting it as a clean close is what leaves a client
	// sitting on a dead connection instead of re-dialling.
	assert.match(src, /remote closed before returning a response/,
		`${file}: request-sent-but-no-response must terminate as a failure`);
	assert.match(src, /new Error\('remote first-byte timeout'\)/, `${file}: first-byte timeout must be named`);
	assert.match(src, /new Error\('remote idle timeout'\)/, `${file}: idle timeout must be named`);

	// Buffered downlink bytes must survive a read error. flush() used to be the last statement INSIDE the
	// read try, so an error skipped it and a small response fragment was silently discarded.
	assert.match(src, /\} catch \(err\) \{ readError = err \}[\s\S]{0,500}?try \{ await 下行发送器\.flush\(\); \}[\s\S]{0,120}?catch \(flushErr\) \{ if \(!readError\) readError = flushErr; \}/,
		`${file}: the final flush must run outside the read try, so accepted bytes are not lost on error`);

	// Regression guard: the old shape must not come back.
	assert.doesNotMatch(src, /if \(!是流取消错误\(error\) && !\(pipeMeta\?\.wrapper\?\.客户端已关闭\)\) log\(`\[Stream pipe\][^\n]*\n\s*closeSocketQuietly\(webSocket\);/,
		`${file}: the remote-read catch is swallowing failures again`);
	assert.doesNotMatch(src, /关闭连接全部Socket\(remoteConnWrapper\); \/\/ close the upstream too \(WS\/gRPC already do\)\n\s*closeSocketQuietly\(xhttpBridge\);\n\s*\} finally/,
		`${file}: the unconditional graceful close on the failure path is back`);
}

console.log('xhttp lifecycle tests passed');
