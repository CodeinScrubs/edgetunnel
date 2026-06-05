import assert from 'node:assert/strict';

const {
	PROXY_RESOLUTION_CACHE_MAX_ENDPOINTS,
	PROXY_RESOLUTION_CACHE_KV_TTL_SECONDS,
	PROXY_RESOLUTION_L1_CACHE,
	getProxyConnectTimeoutMs,
	normalizeProxyCacheRecord,
	orderProxyEndpoints,
	proxyCacheKey,
	readProxyResolutionCache,
	recordProxyEndpointResult,
	parsePreferredEndpoint,
	scheduleProxyCacheWrite,
} = await import('../_worker.js').then(mod => mod.__testPerformanceHelpers);

const now = 1_700_000_000_000;

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
	const record = normalizeProxyCacheRecord({
		version: 1,
		updatedAt: now,
		endpoints: [['throw.example.com', 443]],
		health: {},
	}, now);
	assert.doesNotThrow(() => scheduleProxyCacheWrite({
		KV: {
			put() {
				throw new Error('KV full');
			},
		},
	}, null, 'cache-key', record, now, true));
}

console.log('performance cache tests passed');
