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

// A tunnel URL carries operator configuration in BOTH the query and the path: socks5=user:password@host,
// the http=/https= forms, proxyip=, and the reversible /video/<encoded chain> blob. Redacting a fixed key
// list was not enough twice over -- a value could carry a newline and forge a second log field, and a
// sensitive value could hide under a key not on the list. So log key NAMES only, and redact the path too.
{
	const { __testPerformanceHelpers: H } = await import('../_worker_copypaste.js');
	const r = H.脱敏查询串, rp = H.脱敏隧道路径;
	assert.equal(r('?socks5=user:pass@host:1080'), '?params=socks5', 'only the key name may be logged');
	assert.equal(r('?foo=%0Afake%3Dsecret'), '?params=foo', 'a decoded newline must not forge a second log field');
	assert.equal(r('?sub=https://x.test/p?token=secret'), '?params=sub', 'a secret under an unlisted key must not leak');
	assert.equal(r('?ed=2560&x=1'), '?params=ed,x', 'the set of parameters stays visible for diagnostics');
	assert.equal(r(''), '');
	assert.equal(r('?'), '');
	assert.equal(rp('/video/BLOBBLOB'), '/video/<redacted>', 'the encoded chain blob is reversible configuration');
	assert.equal(rp('/socks5/user:pass@h:1080'), '/proxy/<redacted>', 'path-form proxy credentials must not be logged');
	assert.equal(rp('/gs5=user:pass@h'), '/proxy=<redacted>', 'the =form carries credentials too');
	assert.equal(rp('/plain/path'), '/plain/path', 'ordinary paths stay readable');
	const 注入 = rp('/x' + String.fromCharCode(10) + 'INJECT');
	assert.equal(注入.includes(String.fromCharCode(10)), false, 'no control character may reach a log line');
	assert.equal(注入.includes(String.fromCharCode(13)), false, 'no carriage return either');
}

// The chunk cap rejected the value it advertises as allowed: the read that reports EOF was charged against
// the budget, so exactly 最大分片数 chunks failed. Empty chunks were charged too. And only the SIZE branch
// cancelled -- the count and deadline branches left the request body attached to an invocation that had
// stopped reading it.
{
	const { __testPerformanceHelpers: H } = await import('../_worker_copypaste.js');
	const closed = (n) => new Request('https://x/', { method: 'POST', body: new ReadableStream({
		start(c) { for (let i = 0; i < n; i++) c.enqueue(new Uint8Array([65])); c.close(); },
	}), duplex: 'half' });
	assert.equal((await H.读取有限请求体(closed(8), 65536, 15000, 8)).byteLength, 8, 'exactly the cap must be accepted');
	assert.equal((await H.读取有限请求体(closed(4), 65536, 15000, 8)).byteLength, 4, 'below the cap must be accepted');
	await assert.rejects(() => H.读取有限请求体(closed(9), 65536, 15000, 8), /Too many request body chunks/,
		'one over the cap must be rejected');

	let cancels = 0;
	const open = new Request('https://x/', { method: 'POST', body: new ReadableStream({
		start(c) { for (let i = 0; i < 20; i++) c.enqueue(new Uint8Array([65])); },   // never closes
		cancel() { cancels++; },
	}), duplex: 'half' });
	await assert.rejects(() => H.读取有限请求体(open, 65536, 15000, 5), /Too many request body chunks/);
	assert.equal(cancels, 1, 'a rejected body must be cancelled, not just have its lock released');
}


// "Do not write on a READ" and "always write on an explicit RESET" are INDEPENDENT rules. The read-only
// change satisfied the first and broke the second: ordering the missing-key branch ahead of the reset
// branch meant an /admin reset against an empty namespace wrote nothing while the panel reported success.
// Both directions are pinned here so neither fix can silently undo the other.
{
	const { __testPerformanceHelpers: H } = await import('../_worker_copypaste.js');
	const mk = () => {
		const store = new Map(); const ops = [];
		return { ops, KV: {
			get: async (k) => { ops.push(['get', k]); return store.has(k) ? store.get(k) : null; },
			put: async (k, v) => { ops.push(['put', k]); store.set(k, v); },
			list: async () => ({ keys: [], list_complete: true }), delete: async () => { },
		} };
	};
	const 写入次数 = (ops) => ops.filter(([op, k]) => op === 'put' && k === 'config.json').length;

	const 只读 = mk();
	try { await H.读取config_JSON({ KV: 只读.KV, ADMIN: 'pw', KEY: 'k' }, 'h', 'u', 'UA', false); } catch (e) { }
	assert.equal(写入次数(只读.ops), 0, 'an ordinary read of a missing config must not write — KV Free allows 1000 writes/day');

	const 重置 = mk();
	try { await H.读取config_JSON({ KV: 重置.KV, ADMIN: 'pw', KEY: 'k' }, 'h', 'u', 'UA', true); } catch (e) { }
	assert.equal(写入次数(重置.ops), 1, 'an explicit reset must persist defaults even when the key is absent');
}

// With no credential configured every tunnel route is closed, so userID is null — and a request that simply
// omits ?uuid also yields null. Without the 隧道凭据可用 guard, `null === null` answered /version to anyone.
{
	const worker = (await import('../_worker_copypaste.js')).default;
	const ctx2 = { waitUntil: () => { }, passThroughOnException: () => { } };
	const res = await worker.fetch(new Request('https://t.example/version'), { URL: 'nginx' }, ctx2);
	const body = await res.text();
	assert.ok(!body.includes('"Build"'), '/version must not answer when no credential is configured');
}

// Redacting the logs stopped credentials reaching wrangler tail, but the camouflage subrequest still
// forwarded the raw tunnel path and query to a third-party host — a strictly worse disclosure, since that
// host keeps its own logs.
{
	const worker = (await import('../_worker_copypaste.js')).default;
	const ctx2 = { waitUntil: () => { }, passThroughOnException: () => { } };
	let forwarded = null;
	const prev = globalThis.fetch;
	globalThis.fetch = async (u) => { forwarded = String(u); return new Response('<html>d</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }); };
	const env2 = { ADMIN: 'pw', KEY: 'k', URL: 'https://decoy.example', DEBUG: '0', OFF_LOG: '1' };
	await worker.fetch(new Request('https://t.example/socks5/user:pass@proxy.example:1080?token=secret'), env2, ctx2).catch(() => { });
	globalThis.fetch = prev;
	assert.ok(forwarded, 'the decoy should have been fetched');
	assert.ok(!/pass|secret/.test(forwarded), `the decoy must not receive tunnel credentials, got ${forwarded}`);
	assert.ok(!forwarded.includes('?'), `the decoy must receive no query at all, got ${forwarded}`);
}


// Percent-encoding walked straight past the path redactor: its patterns match a literal '/', so
// /video%2Fabc was logged verbatim while decoding to exactly the path the rule exists to hide, and %252F
// hid it one layer deeper. Decode before matching.
{
	const { __testPerformanceHelpers: H } = await import('../_worker_copypaste.js');
	const rp = H.脱敏隧道路径;
	for (const p2 of ['/video%2Fabc', '/VIDEO%2fabc', '/video%252Fabc', '/socks5%2Fuser:pass@h']) {
		const out = rp(p2);
		assert.ok(!/abc|pass/.test(out), `${p2} must not survive redaction, got ${out}`);
	}
	assert.equal(rp('/plain/path'), '/plain/path', 'an ordinary path must be untouched');
	assert.equal(rp('/about'), '/about', 'decoding must not mangle ordinary paths');
}

// An explicitly configured but INVALID UUID used to be ignored in favour of the derived identity, so the
// worker kept serving under a credential the operator never chose. Fail closed -- but the panel must stay
// reachable to fix it, which is the objection that made this look unsafe until admin gating was checked.
{
	const worker = (await import('../_worker_copypaste.js')).default;
	const ctx2 = { waitUntil: () => { }, passThroughOnException: () => { } };
	const prev = globalThis.fetch;
	globalThis.fetch = async () => new Response('<html>d</html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
	const kv = { get: async () => null, put: async () => { }, list: async () => ({ keys: [] }), delete: async () => { } };
	const base = { ADMIN: 'pw', KEY: 'k', URL: 'nginx', DEBUG: '0', OFF_LOG: '1', KV: kv };

	const bad = { ...base, UUID: 'not-a-uuid' };
	const v = await worker.fetch(new Request('https://t.example/version'), bad, ctx2);
	assert.ok(!(await v.text()).includes('"Build"'), 'an invalid UUID must disable tunnel identity, not swap in another');
	const a = await worker.fetch(new Request('https://t.example/admin'), bad, ctx2);
	assert.equal(a.status, 302, 'admin must stay reachable so the operator can fix the value');

	const good = { ...base, UUID: '8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04' };
	const v2 = await worker.fetch(new Request('https://t.example/version?uuid=8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04'), good, ctx2);
	assert.ok((await v2.text()).includes('"Build"'), 'a valid UUID must be unaffected');

	const absent = { ...base };
	const v3 = await worker.fetch(new Request('https://t.example/robots.txt'), absent, ctx2);
	assert.ok((await v3.text()).includes('User-agent'), 'an ABSENT UUID must still derive as before');

	const escape = { ...bad, ALLOW_INVALID_UUID_DERIVATION: '1' };
	const v4 = await worker.fetch(new Request('https://t.example/robots.txt'), escape, ctx2);
	assert.equal(v4.status, 200, 'the compatibility flag must restore the old behaviour');
	globalThis.fetch = prev;
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