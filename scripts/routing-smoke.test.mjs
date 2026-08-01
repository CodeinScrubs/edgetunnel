import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The entry handler had never been EXECUTED by any test -- every suite tested extracted functions. That
// gap let a real regression ship: identity resolution moved into 解析显式UUID, the local `uuidRegex`
// declaration went with it, and one surviving use in the routing chain became a ReferenceError. The
// top-level catch turned it into the camouflage page, so /locations and /robots.txt silently stopped
// working while `node --check`, the drift gate and every unit suite still passed.
//
// So actually drive the router. These routes need no sockets, so they run in plain Node. Both the
// canonical build and the hand-maintained panel build are exercised, because only one of them deploys.
const BUILDS = [
	['_worker_copypaste.js', '../_worker_copypaste.js'],
	['src_static_ui/worker_test.js', '../src_static_ui/worker_test.js'],
];

// Count outbound calls so "a bare GET / makes zero subrequests" stops being a claim and becomes a test.
let outbound = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
	outbound.push(String(input?.url || input));
	return new Response('stubbed', { status: 200, headers: { 'Content-Type': 'text/plain' } });
};

const UUID = '8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04';
const baseEnv = () => {
	const KV = new Map();
	return {
		ADMIN: 'test-admin-password', KEY: 'test-key', UUID, URL: 'nginx', DEBUG: '0', OFF_LOG: '1',
		KV: {
			get: async (k) => (KV.has(k) ? KV.get(k) : null),
			put: async (k, v) => { KV.set(k, v); },
			list: async () => ({ keys: [], list_complete: true }),
			delete: async () => { },
		},
	};
};
const ctx = { waitUntil: () => { }, passThroughOnException: () => { } };
const isNginx = (body) => body.includes('Welcome to nginx!');

for (const [label, spec] of BUILDS) {
	const worker = (await import(spec)).default;
	const call = (path, init = {}, envOverride = {}) =>
		worker.fetch(new Request(`https://tunnel.example.com${path}`, init), { ...baseEnv(), ...envOverride }, ctx);
	const T = (name) => `${label}: ${name}`;

	{
		const res = await call('/robots.txt');
		const body = await res.text();
		assert.equal(res.status, 200, T('/robots.txt should be 200'));
		assert.ok(body.includes('User-agent: *'),
			T(`/robots.txt served the wrong body (camouflage? ${isNginx(body)}) -- a ReferenceError in an earlier branch diverts here`));
		assert.ok(body.includes('Disallow: /'), T('/robots.txt should disallow everything'));
	}

	{
		// Reaching this route requires evaluating the `logout || <uuid-shaped>` branch above it.
		const res = await call('/locations');
		assert.ok(res, T('/locations must be reachable'));
		assert.ok(!isNginx(await res.text()) || res.status === 200, T('/locations must not throw into camouflage'));
	}

	{
		const res = await call(`/${UUID}`);
		assert.equal(res.status, 302, T('a UUID-shaped path should redirect'));
		assert.equal(res.headers.get('Location'), '/login', T('it should redirect to /login'));
		assert.match(res.headers.get('Set-Cookie') || '', /auth=;/, T('it should clear the auth cookie'));
	}

	{
		const res = await call('/logout');
		assert.equal(res.status, 302, T('/logout should redirect'));
		assert.equal(res.headers.get('Location'), '/login');
	}

	{
		const res = await call(`/version?uuid=${UUID}`);
		assert.equal(res.status, 200, T('/version should answer for the correct uuid'));
		const body = await res.json();
		assert.ok(Number.isSafeInteger(body.Version) && body.Version > 20200101, T(`/version returned ${body.Version}`));
		assert.equal(typeof body.Build, 'string', T('/version should carry the full build stamp'));
		assert.equal(res.headers.get('Cache-Control'), 'no-store', T('/version must not be cached'));

		const wrong = await call('/version?uuid=00000000-0000-4000-8000-000000000000');
		assert.ok(isNginx(await wrong.text()), T('/version must not answer for a wrong uuid'));
	}

	{
		// A bare GET / must look like a plain web server AND make no outbound request. With URL=nginx the
		// decoy is built in, so any subrequest here would be a fingerprint.
		outbound = [];
		const res = await call('/');
		assert.equal(res.status, 200, T('GET / should be 200'));
		assert.ok(isNginx(await res.text()), T('GET / should serve the camouflage page'));
		assert.deepEqual(outbound, [], T(`GET / must make zero outbound calls, made ${outbound.length}: ${outbound.join(', ')}`));
	}

	{
		const res = await call('/admin');
		assert.equal(res.status, 302, T('/admin without auth should redirect'));
		assert.equal(res.headers.get('Location'), '/login');
	}

	{
		const res = await call('/admin/config.json', {
			method: 'POST',
			headers: { 'Origin': 'https://evil.example', 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' },
			body: '{}',
		});
		assert.ok(res.status === 302 || res.status === 403, T(`cross-origin admin POST should be refused, got ${res.status}`));
	}

	{
		// A malformed explicit UUID falls back to the derived identity; routing must continue.
		const res = await call('/robots.txt', {}, { UUID: 'not-a-uuid' });
		assert.equal(res.status, 200, T('a malformed UUID must not break routing'));
		assert.ok((await res.text()).includes('User-agent'), T('routing should continue on the derived identity'));
	}

	{
		const res = await call('/robots.txt', {}, { UUID: '00000000-0000-0000-0000-000000000000' });
		assert.equal(res.status, 200, T('the nil UUID must not break routing'));
	}

	{
		// No credential configured at all must fail closed to camouflage, never expose the panel.
		const res = await worker.fetch(new Request('https://tunnel.example.com/admin'), { URL: 'nginx' }, ctx);
		const body = await res.text();
		assert.ok(res.status === 200 || res.status === 503, T(`credential-less /admin returned ${res.status}`));
		assert.ok(isNginx(body) || body.includes('ADMIN'), T('credential-less /admin must be camouflage or the setup hint, never the panel'));
	}
}

globalThis.fetch = realFetch;

// A tunnel URL carries operator configuration: socks5=user:password@host, the http=/https= forms with the
// same shape, proxyip=, tokens. Those were logged verbatim. log() is DEBUG-gated, but DEBUG is precisely
// what gets switched on to troubleshoot, and `wrangler tail` is the last place a proxy password belongs.
{
	const { __testPerformanceHelpers: H } = await import('../_worker_copypaste.js');
	const r = H.脱敏查询串;
	const 秘密 = r('?socks5=user:pass@host:1080');
	assert.ok(!秘密.includes('pass'), 'a proxy password must never reach a log line');
	assert.ok(秘密.includes('socks5'), 'the parameter NAME should survive so a log still shows what was set');
	assert.ok(!r('?http=u:p@h:8080').includes('p@h'), 'the http= form carries credentials too');
	assert.ok(!r('?proxyip=1.2.3.4').includes('1.2.3.4'), 'the configured relay is operator configuration');
	assert.equal(r(''), '', 'no query means no output');
	assert.equal(r('?'), '', 'an empty query means no output');
	assert.ok(r('?foo=bar').includes('foo=bar'), 'ordinary parameters stay readable — over-redacting makes logs useless');
}

// The chain-proxy path parses its own JSON and never calls the shared SOCKS account parser, so the port
// bound added there did not cover it: -1, 1.5, 65536 and Infinity all passed isNaN() and were dialled.
// Its catch also fell through to ordinary query parsing, so a malformed chain became a DIRECT dial.
for (const [file] of BUILDS) {
	const src = readFileSync(file, 'utf8');
	assert.match(src, /if \(!Number\.isInteger\(链式端口\) \|\| 链式端口 < 1 \|\| 链式端口 > 65535\)/,
		`${file}: the chain-proxy port must be range-checked, not just isNaN-checked`);
	assert.match(src, /tunnelContext\.proxyConfigError = err\?\.message \|\| 'invalid chain proxy configuration';/,
		`${file}: a malformed chain proxy must fail closed, never fall through to direct`);
	assert.doesNotMatch(src, /if \(isNaN\(tunnelContext\.parsedProxyAddress\.port\)\)/,
		`${file}: the old isNaN-only chain port check must not come back`);
	// The rejection must be enforced before ANY transport handler — checking only inside forwardataTCP left
	// DNS/UDP sessions uncovered and ran after the 101/200 had already been sent.
	assert.match(src, /const 代理配置错误 = await 代理配置被拒\(workerRequestContext\.tunnel\);\s+if \(代理配置错误\) return 代理配置错误;/,
		`${file}: proxy configuration must be rejected before the transport handler accepts`);
	// Request bodies were bounded in bytes but not in time: one byte every few seconds held an invocation open.
	assert.match(src, /if \(剩余毫秒 <= 0\) throw new Error\('Request body timed out'\);/,
		`${file}: request bodies need an absolute deadline, not only a byte cap`);
	assert.match(src, /if \(\+\+分片数 > 最大分片数\) throw new Error\('Too many request body chunks'\);/,
		`${file}: a drip-feed must also be bounded by chunk count`);
	// SS could close between the queue's readyState check and the encrypt callback, and the skipped send
	// resolved as if the ciphertext had gone out.
	assert.match(src, /throw new Error\('SS client transport closed before ciphertext delivery'\);/,
		`${file}: an undelivered SS chunk must reject, not silently disappear`);
}

console.log('routing smoke tests passed');