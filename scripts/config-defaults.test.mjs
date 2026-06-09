import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ENGINE_DEFAULTS, USER_CONFIG, applyUserConfigDefaults } from '../src/core/config.js';

function makeFakeKV(initialEntries = {}) {
	const store = new Map(Object.entries(initialEntries));
	return {
		async get(key) {
			return store.has(key) ? store.get(key) : null;
		},
		async put(key, value) {
			store.set(key, value);
		},
	};
}

{
	const originalAdmin = USER_CONFIG.ADMIN;
	const originalDns = USER_CONFIG.DNS_SERVER;
	try {
		USER_CONFIG.ADMIN = 'static-admin';
		USER_CONFIG.DNS_SERVER = '1.1.1.1:53';
		const env = applyUserConfigDefaults({ ADMIN: 'env-admin' });

		assert.equal(env.ADMIN, 'env-admin', 'Cloudflare env values must override top static defaults');
		assert.equal(env.DNS_SERVER, '1.1.1.1:53', 'top static defaults should fill missing env values');
	} finally {
		USER_CONFIG.ADMIN = originalAdmin;
		USER_CONFIG.DNS_SERVER = originalDns;
	}
}

{
	const env = { KV: { get() {} } };
	const merged = applyUserConfigDefaults(env);
	assert.equal(merged.KV, env.KV, 'non-string runtime bindings must be preserved');
}

{
	assert.equal(ENGINE_DEFAULTS.PROXY_CONNECT_TIMEOUT_DEFAULT_MS, 850);
	assert.equal(ENGINE_DEFAULTS.DNS_TCP_RESPONSE_TIMEOUT_MS, 1200);
	assert.equal(ENGINE_DEFAULTS.GRPC_MAX_FRAME_PAYLOAD_BYTES, 16 * 1024 * 1024);
	assert.equal(ENGINE_DEFAULTS.PAGES_STATIC_URL, 'https://edt-pages.github.io');
	assert.equal(ENGINE_DEFAULTS.DEFAULT_DOH_LOOKUP_URL, 'https://cloudflare-dns.com/dns-query');
	assert.equal(ENGINE_DEFAULTS.DEFAULT_DNS_TCP_SERVER, '8.8.4.4:53');
	assert.equal(ENGINE_DEFAULTS.DEFAULT_SOCKS5_WHITELIST.includes('scholar.google.com'), true);
}

{
	const generated = await readFile('_worker.js', 'utf8');
	assert.equal(generated.startsWith('// Generated from src/worker.js by scripts/build-worker.mjs.'), true);
	assert.equal(/^import\s+/m.test(generated), false, 'generated deployable Worker must not contain unresolved imports');
	assert.equal(generated.includes('const USER_CONFIG = {'), true);
	assert.equal(generated.includes('const ENGINE_DEFAULTS = {'), true);
}

{
	const workerModule = await import('../_worker.js');
	const { readConfigJson } = workerModule.__testPerformanceHelpers;
	const config = await readConfigJson({
		KV: makeFakeKV(),
		TRANSPORT: 'grpc',
		GRPC_MODE: 'multi',
		GRPC_USER_AGENT: 'TopConfigUA/1.0',
		FP: 'firefox',
		SUBNAME: 'top-config-sub',
		SUB_UPDATE_TIME: '9',
	}, 'worker.example', '11111111-1111-4111-8111-111111111111', 'DefaultUA/1.0');

	assert.equal(config['\u4f20\u8f93\u534f\u8bae'], 'grpc');
	assert.equal(config['gRPC\u6a21\u5f0f'], 'multi');
	assert.equal(config.gRPCUserAgent, 'TopConfigUA/1.0');
	assert.equal(config.Fingerprint, 'firefox');
	assert.equal(config['\u4f18\u9009\u8ba2\u9605\u751f\u6210'].SUBNAME, 'top-config-sub');
	assert.equal(config['\u4f18\u9009\u8ba2\u9605\u751f\u6210'].SUBUpdateTime, 9);
}

console.log('config defaults tests passed');
