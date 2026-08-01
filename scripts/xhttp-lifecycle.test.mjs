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

	// Regression guard: the old shape must not come back.
	assert.doesNotMatch(src, /关闭连接全部Socket\(remoteConnWrapper\); \/\/ close the upstream too \(WS\/gRPC already do\)\n\s*closeSocketQuietly\(xhttpBridge\);\n\s*\} finally/,
		`${file}: the unconditional graceful close on the failure path is back`);
}

console.log('xhttp lifecycle tests passed');
