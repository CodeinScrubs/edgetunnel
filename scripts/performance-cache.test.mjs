import assert from 'node:assert/strict';

const {
	PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS,
	PROXY_RESOLUTION_CACHE_KV_TTL_SECONDS,
	PROXY_RESOLUTION_L1_CACHE,
	DNS_RESULT_CACHE,
	MD5MD5_RESULT_CACHE,
	SHA224_RESULT_CACHE,
	getProxyConnectTimeoutMs,
	normalizeProxyCacheRecord,
	orderProxyEndpoints,
	proxyCacheKey,
	readProxyResolutionCache,
	recordProxyEndpointResult,
	parsePreferredEndpoint,
	scheduleProxyCacheWrite,
	resetProxyCacheKvThrottle,
	isProxyResolutionKvCacheEnabled,
	PROXY_RESOLUTION_CACHE_KV_MIN_GLOBAL_INTERVAL_MS,
	DoH查询,
	MD5MD5,
	sha224,
	parseDnsTcpFrames,
} = await import('../_worker.js').then(mod => mod.__testPerformanceHelpers);

const now = 1_700_000_000_000;

function encodeDnsName(name) {
	const encoder = new TextEncoder();
	const labels = String(name).split('.').filter(Boolean);
	const chunks = labels.map(label => encoder.encode(label));
	const length = chunks.reduce((sum, chunk) => sum + 1 + chunk.byteLength, 1);
	const out = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		out[offset++] = chunk.byteLength;
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	out[offset] = 0;
	return out;
}

function makeDnsAResponse(name, ttl, ipBytes) {
	const qname = encodeDnsName(name);
	const response = new Uint8Array(12 + qname.byteLength + 4 + 16);
	const view = new DataView(response.buffer);
	view.setUint16(0, 0x1234);
	view.setUint16(2, 0x8180);
	view.setUint16(4, 1);
	view.setUint16(6, 1);
	response.set(qname, 12);
	let offset = 12 + qname.byteLength;
	view.setUint16(offset, 1); offset += 2;
	view.setUint16(offset, 1); offset += 2;
	response[offset++] = 0xc0;
	response[offset++] = 0x0c;
	view.setUint16(offset, 1); offset += 2;
	view.setUint16(offset, 1); offset += 2;
	view.setUint32(offset, ttl); offset += 4;
	view.setUint16(offset, 4); offset += 2;
	response.set(ipBytes, offset);
	return response;
}

{
	MD5MD5_RESULT_CACHE.clear();
	SHA224_RESULT_CACHE.clear();
	const firstMd5 = await MD5MD5('same-admin-key');
	const secondMd5 = await MD5MD5('same-admin-key');
	assert.equal(firstMd5, secondMd5);
	assert.equal(MD5MD5_RESULT_CACHE.size, 1, 'repeated MD5MD5 inputs should use the bounded hash cache');

	const firstSha = sha224('same-trojan-password');
	const secondSha = sha224('same-trojan-password');
	assert.equal(firstSha, secondSha);
	assert.equal(SHA224_RESULT_CACHE.size, 1, 'repeated Trojan sha224 inputs should use the bounded hash cache');
	MD5MD5_RESULT_CACHE.clear();
	SHA224_RESULT_CACHE.clear();
}

{
	DNS_RESULT_CACHE.clear();
	const originalFetch = globalThis.fetch;
	let fetchCalls = 0;
	globalThis.fetch = async () => {
		fetchCalls++;
		return new Response(makeDnsAResponse('cache.example', 120, new Uint8Array([203, 0, 113, 7])), {
			status: 200,
			headers: { 'Content-Type': 'application/dns-message' },
		});
	};
	try {
		const first = await DoH查询('cache.example', 'A', 'https://resolver.test/dns-query');
		const second = await DoH查询('CACHE.example', 'a', 'https://resolver.test/dns-query');
		assert.equal(fetchCalls, 1, 'second equivalent DoH lookup should use the in-memory DNS result cache');
		assert.equal(first[0].data, '203.0.113.7');
		assert.equal(second[0].data, '203.0.113.7');
		second[0].rdata[0] = 1;
		const third = await DoH查询('cache.example', 'A', 'https://resolver.test/dns-query');
		assert.equal(third[0].rdata[0], 203, 'cached DoH answers should be cloned before returning');
	} finally {
		globalThis.fetch = originalFetch;
		DNS_RESULT_CACHE.clear();
	}
}

{
	const record = normalizeProxyCacheRecord({
		version: 1,
		createdAt: now - 1_000,
		updatedAt: now - 1_000,
		endpoints: [
			['1.1.1.1', 443],
			['2.2.2.2', '8443'],
			['bad-port', 70000],
			['bad host name', 443],
			['2001:db8::1', 443],
			['3.3.3.3', 443],
			['4.4.4.4', 443],
			['5.5.5.5', 443],
			['6.6.6.6', 443],
			['7.7.7.7', 443],
			['8.8.8.8', 443],
			['9.9.9.9', 443],
		],
		health: {
			'2.2.2.2:8443': { successes: 2, failures: 1, latencyMs: 120, cooldownUntil: now - 1 },
		},
	}, now);

	assert.equal(record.endpoints.length, PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS);
	assert.deepEqual(record.endpoints[1], ['2.2.2.2', 8443]);
	assert.equal(record.endpoints.some(([host]) => host === 'bad-port'), false);
	assert.equal(record.endpoints.some(([host]) => host === 'bad host name'), false);
	assert.ok(record.endpoints.some(([host]) => host === '2001:db8::1'));
	assert.equal(record.health['2.2.2.2:8443'].latencyMs, 120);
}

{
	const record = normalizeProxyCacheRecord({
		version: 1,
		updatedAt: now - 30 * 60 * 1000,
		endpoints: [['1.1.1.1', 443]],
	}, now);

	assert.equal(record.isFresh, false);
	assert.deepEqual(record.endpoints, [['1.1.1.1', 443]]);
}

{
	const record = normalizeProxyCacheRecord({
		version: 1,
		updatedAt: now - 7 * 60 * 60 * 1000,
		endpoints: [['1.1.1.1', 443]],
	}, now);

	assert.equal(record, null);
}

{
	const endpoints = [
		['slow.example', 443],
		['fast.example', 443],
		['cooled.example', 443],
		['unknown.example', 443],
	];
	const ordered = orderProxyEndpoints(endpoints, {
		'slow.example:443': { successes: 5, failures: 0, latencyMs: 450 },
		'fast.example:443': { successes: 5, failures: 0, latencyMs: 80 },
		'cooled.example:443': { successes: 20, failures: 3, latencyMs: 20, cooldownUntil: now + 60_000 },
	}, now, 'seed');

	assert.deepEqual(ordered[0], ['fast.example', 443]);
	assert.equal(ordered.some(([host]) => host === 'cooled.example'), false);
	assert.equal(ordered.length, 3);
}

{
	const endpoints = [['a.example', 443], ['b.example', 443]];
	const ordered = orderProxyEndpoints(endpoints, {
		'a.example:443': { failures: 3, cooldownUntil: now + 60_000 },
		'b.example:443': { failures: 4, cooldownUntil: now + 60_000 },
	}, now, 'seed');

	assert.equal(ordered.length, 2, 'all-cooled lists should still return fallbacks');
}

{
	const record = normalizeProxyCacheRecord({
		version: 1,
		updatedAt: now,
		endpoints: [['a.example', 443]],
		health: {},
	}, now);

	recordProxyEndpointResult(record, ['a.example', 443], false, 900, now);
	recordProxyEndpointResult(record, ['a.example', 443], false, 850, now + 1_000);
	assert.ok(record.health['a.example:443'].cooldownUntil > now, 'repeated failures should cool down endpoint');

	recordProxyEndpointResult(record, ['a.example', 443], true, 100, now + 2_000);
	assert.equal(record.health['a.example:443'].failures, 0);
	assert.equal(record.health['a.example:443'].latencyMs, 100);
}

{
	const resolutionUpdatedAt = now - 30 * 60 * 1000;
	const record = normalizeProxyCacheRecord({
		version: 1,
		updatedAt: resolutionUpdatedAt,
		endpoints: [['freshness.example', 443]],
		health: {},
	}, now);

	assert.equal(record.isFresh, false);
	recordProxyEndpointResult(record, ['freshness.example', 443], true, 100, now);
	assert.equal(record.updatedAt, resolutionUpdatedAt, 'health updates must not make old resolution data look freshly resolved');
	assert.equal(normalizeProxyCacheRecord(record, now).isFresh, false);
}

{
	assert.equal(getProxyConnectTimeoutMs({}), 850);
	assert.equal(getProxyConnectTimeoutMs({ CONNECT_TIMEOUT_MS: '200' }), 400);
	assert.equal(getProxyConnectTimeoutMs({ CONNECT_TIMEOUT_MS: '5000' }), 1500);
	assert.equal(getProxyConnectTimeoutMs({ CONNECT_TIMEOUT_MS: '950' }), 950);
}

{
	assert.notEqual(
		proxyCacheKey('proxy.example.com', 'telegram.org', '00000000-0000-4000-8000-000000000000'),
		proxyCacheKey('proxy.example.com', 'youtube.com', '00000000-0000-4000-8000-000000000000'),
		'target-dependent proxy resolution needs a target-aware cache key'
	);
	assert.notEqual(
		proxyCacheKey('proxy.example.com', 'telegram.org', '00000000-0000-4000-8000-000000000000'),
		proxyCacheKey('proxy.example.com', 'telegram.org', '11111111-1111-4111-8111-111111111111'),
		'UUID-dependent proxy resolution needs a UUID-aware cache key'
	);
}

{
	assert.deepEqual(parsePreferredEndpoint('104.21.105.47#ip'), {
		address: '104.21.105.47',
		port: '443',
		remark: 'ip',
	});
	assert.deepEqual(parsePreferredEndpoint('front.example.com:443#domain'), {
		address: 'front.example.com',
		port: '443',
		remark: 'domain',
	});
	assert.deepEqual(parsePreferredEndpoint('video.example.co.uk:8443#subdomain'), {
		address: 'video.example.co.uk',
		port: '8443',
		remark: 'subdomain',
	});
	assert.equal(parsePreferredEndpoint('bad host name:443#nope'), null);
}

{
	PROXY_RESOLUTION_L1_CACHE.clear();
	const cacheKey = proxyCacheKey('proxy.example.com');
	const stored = JSON.stringify({
		version: 1,
		updatedAt: now,
		endpoints: [['kv.example.com', 443]],
		health: { 'kv.example.com:443': { successes: 3, latencyMs: 90, lastSeenAt: now } },
	});
	let getCalls = 0;
	const env = {
		ENABLE_KV_PROXY_CACHE: '1',
		KV: {
			async get(key) {
				getCalls++;
				assert.equal(key, cacheKey);
				return stored;
			},
		},
	};

	const first = await readProxyResolutionCache(env, 'proxy.example.com', now);
	assert.equal(first.source, 'kv');
	assert.deepEqual(first.record.endpoints, [['kv.example.com', 443]]);

	const second = await readProxyResolutionCache(env, 'proxy.example.com', now);
	assert.equal(second.source, 'memory');
	assert.equal(getCalls, 1, 'second lookup should use L1 memory cache');
	PROXY_RESOLUTION_L1_CACHE.clear();
}

{
	const puts = [];
	const waitUntilPromises = [];
	const env = {
		ENABLE_KV_PROXY_CACHE: '1',
		KV: {
			put(key, value, options) {
				puts.push({ key, value: JSON.parse(value), options });
				return Promise.resolve();
			},
		},
	};
	const ctx = {
		waitUntil(promise) {
			waitUntilPromises.push(promise);
		},
	};
	const record = normalizeProxyCacheRecord({
		version: 1,
		updatedAt: now,
		endpoints: [['write.example.com', 443]],
		health: {},
	}, now);

	resetProxyCacheKvThrottle();
	scheduleProxyCacheWrite(env, ctx, 'cache-key', record, now, false);
	scheduleProxyCacheWrite(env, ctx, 'cache-key', record, now + 1_000, false);
	assert.equal(puts.length, 1, 'same-record writes should be throttled');
	assert.equal(puts[0].value.lastKvWriteAt, now);
	assert.equal(normalizeProxyCacheRecord(puts[0].value, now).lastKvWriteAt, now);
	assert.equal(waitUntilPromises.length, 1);
	assert.equal(puts[0].options.expirationTtl, PROXY_RESOLUTION_CACHE_KV_TTL_SECONDS);
	await Promise.all(waitUntilPromises);
}

{
	// Persistent proxy KV cache is ON by default now (writes are globally throttled + TTL'd).
	assert.equal(isProxyResolutionKvCacheEnabled({}), true, 'proxy KV cache is on by default');
	assert.equal(isProxyResolutionKvCacheEnabled({ OFF_PROXY_CACHE: '1' }), false, 'OFF_PROXY_CACHE disables it');
	assert.equal(isProxyResolutionKvCacheEnabled({ ENABLE_KV_PROXY_CACHE: '0' }), false, 'explicit 0 disables it');

	resetProxyCacheKvThrottle();
	const onPuts = [];
	scheduleProxyCacheWrite({ KV: { put(k, v, o) { onPuts.push({ k }); return Promise.resolve(); } } },
		null, 'cache-key', normalizeProxyCacheRecord({ version: 1, updatedAt: now, endpoints: [['on.example.com', 443]], health: {} }, now), now, true);
	assert.equal(onPuts.length, 1, 'default-on cache writes without an explicit flag');

	resetProxyCacheKvThrottle();
	const offPuts = [];
	scheduleProxyCacheWrite({ OFF_PROXY_CACHE: '1', KV: { put(k, v, o) { offPuts.push({ k }); return Promise.resolve(); } } },
		null, 'cache-key', normalizeProxyCacheRecord({ version: 1, updatedAt: now, endpoints: [['off.example.com', 443]], health: {} }, now), now, true);
	assert.equal(offPuts.length, 0, 'OFF_PROXY_CACHE suppresses the write');
}

{
	// Global throttle caps total writes across DISTINCT target-aware keys (free-plan KV safety).
	resetProxyCacheKvThrottle();
	const puts = [];
	const env = { ENABLE_KV_PROXY_CACHE: '1', KV: { put(k, v, o) { puts.push({ k }); return Promise.resolve(); } } };
	const recA = normalizeProxyCacheRecord({ version: 1, updatedAt: now, endpoints: [['a.example.com', 443]], health: {} }, now);
	const recB = normalizeProxyCacheRecord({ version: 1, updatedAt: now, endpoints: [['b.example.com', 443]], health: {} }, now);
	scheduleProxyCacheWrite(env, null, 'key-a', recA, now, true);
	scheduleProxyCacheWrite(env, null, 'key-b', recB, now + 1_000, true);
	assert.equal(puts.length, 1, 'second distinct-key write within the global interval is throttled');
	scheduleProxyCacheWrite(env, null, 'key-b', recB, now + PROXY_RESOLUTION_CACHE_KV_MIN_GLOBAL_INTERVAL_MS + 1, true);
	assert.equal(puts.length, 2, 'a write past the global interval is allowed');
}

{
	const record = normalizeProxyCacheRecord({
		version: 1,
		updatedAt: now,
		endpoints: [['throw.example.com', 443]],
		health: {},
	}, now);
	resetProxyCacheKvThrottle();
	assert.doesNotThrow(() => scheduleProxyCacheWrite({
		ENABLE_KV_PROXY_CACHE: '1',
		KV: {
			put() {
				throw new Error('KV full');
			},
		},
	}, null, 'cache-key', record, now, true));
}

{
	// DNS-over-TCP frame parser feeds the DoH forwarder: splits [len][msg][len][msg] correctly.
	const frame = (msg) => { const f = new Uint8Array(2 + msg.length); f[0] = (msg.length >>> 8) & 0xff; f[1] = msg.length & 0xff; f.set(msg, 2); return f; };
	const q1 = new Uint8Array([1, 2, 3]), q2 = new Uint8Array([9, 9]);
	const buf = new Uint8Array([...frame(q1), ...frame(q2)]);
	const parsed = parseDnsTcpFrames(buf);
	assert.equal(parsed.length, 2, 'two length-prefixed DNS frames are parsed');
	assert.deepEqual([...parsed[0]], [1, 2, 3], 'first DNS query payload is extracted without the length prefix');
	assert.deepEqual([...parsed[1]], [9, 9], 'second DNS query payload is extracted');
	assert.deepEqual(parseDnsTcpFrames(new Uint8Array([0, 5, 1, 2])), [], 'a truncated frame is not emitted');
}

console.log('performance cache tests passed');
