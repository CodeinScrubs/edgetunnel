import assert from 'node:assert/strict';

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
console.log('routing smoke tests passed');
