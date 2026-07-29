import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Socket.close() returns Promise<void>. A bare try/catch catches only a SYNCHRONOUS throw, so a rejection
// (peer already RST, socket already torn down) escapes as an unhandled rejection.
//
// Converting call sites to closeRemoteSocketQuietly() was NOT sufficient: TlsClient.close() called
// this.socket.close() and discarded the result, so the helper received undefined and guarded nothing.
// A scan for the call-site TOKEN could never catch that -- the defect lived one level down, inside the
// wrapper. So test the BEHAVIOUR: give each closer a socket whose close() rejects and assert nothing
// escapes.
const BUILDS = ['_worker_copypaste.js', 'wrangler_deploy_method_worker/_worker.js', 'src_static_ui/worker_test.js'];

function extract(text, name, kind = 'function') {
	const needle = kind === 'class' ? `class ${name} ` : `function ${name}(`;
	const i = text.indexOf(needle);
	assert.ok(i >= 0, `missing ${name}`);
	const open = text.indexOf('{', i);
	let d = 0, seen = false, j = open;
	for (; j < text.length; j++) { const c = text[j]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { j++; break; } } }
	return text.slice(i, j);
}

const settle = () => new Promise((r) => setTimeout(r, 10));

for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');
	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason);
	process.on('unhandledRejection', onUnhandled);
	try {
		const helper = new Function(extract(src, 'closeRemoteSocketQuietly') + '\nreturn closeRemoteSocketQuietly;')();

		// 1. The helper itself must swallow an async rejection.
		helper({ close: () => Promise.reject(new Error('helper-reject')) });
		await settle();
		assert.deepEqual(unhandled, [], `${file}: closeRemoteSocketQuietly leaked a rejection`);

		// 2. ...and a synchronous throw, and a missing close method.
		helper({ close: () => { throw new Error('sync-throw'); } });
		helper({});
		helper(null);
		await settle();
		assert.deepEqual(unhandled, [], `${file}: closeRemoteSocketQuietly leaked on sync/absent close`);

		// 3. TlsClient.close() must consume the UNDERLYING socket's rejection. This is the case the
		//    call-site conversion missed entirely.
		assert.match(src, /close\(\) \{ closeRemoteSocketQuietly\(this\.socket\) \}/,
			`${file}: TlsClient.close() must route through closeRemoteSocketQuietly, not discard the promise`);

		const tlsClose = new Function(
			extract(src, 'closeRemoteSocketQuietly') +
			'\nreturn function (socket) { const self = { socket }; return (' +
			'function () { closeRemoteSocketQuietly(this.socket) }' +
			').call(self); };')();
		tlsClose({ close: () => Promise.reject(new Error('underlying-close-reject')) });
		await settle();
		assert.deepEqual(unhandled, [], `${file}: TlsClient.close() leaked the underlying socket rejection`);

		// 4. No unguarded raw close/cancel shapes may reappear anywhere in a shipped build.
		for (const [label, re] of [
			['bare 半关闭Socket.close()', /try \{ 半关闭Socket\.close\(\) \} catch/],
			['unawaited tlsSocket ternary close', /tlsSocket \? tlsSocket\.close\(\) :/],
			['unguarded dataReader.cancel()', /try \{ dataReader\?\.cancel\?\.\(\) \} catch/],
			['TlsClient discarding its close promise', /close\(\) \{ this\.socket\.close\(\) \}/],
		]) {
			assert.doesNotMatch(src, re, `${file}: ${label} is back — its rejection escapes the try/catch`);
		}
	} finally {
		process.off('unhandledRejection', onUnhandled);
	}
}

console.log('close-safety tests passed');
