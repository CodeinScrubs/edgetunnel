import assert from 'node:assert/strict';

globalThis.WebSocket = globalThis.WebSocket || { OPEN: 1, CLOSING: 2, CLOSED: 3 };

const helpers = await import('../_worker.js').then(mod => mod.__testPerformanceHelpers);

const {
	createTunnelContext,
	applyProxyParamsToTunnelContext,
	getProxyResolutionRecord,
	fetchWithTimeout,
	openStaggeredCandidates,
	connectStreams,
	expandPreferredEndpointVariants,
} = helpers;

function fakeRequest({ colo = 'SJC', asn = 13335, asOrganization = 'Cloudflare' } = {}) {
	return {
		cf: { colo, asn, asOrganization },
		headers: {
			get(name) {
				if (String(name).toLowerCase() === 'cf-connecting-ip') return '203.0.113.10';
				return null;
			},
		},
	};
}

{
	assert.deepEqual(expandPreferredEndpointVariants('speedtest.net'), ['speedtest.net', 'www.speedtest.net']);
	assert.deepEqual(expandPreferredEndpointVariants('www.speedtest.net'), ['www.speedtest.net', 'speedtest.net']);
	assert.deepEqual(expandPreferredEndpointVariants('example.com:8443#edge'), ['example.com:8443#edge', 'www.example.com:8443#edge']);
	assert.deepEqual(expandPreferredEndpointVariants('104.21.105.47:443#ip'), ['104.21.105.47:443#ip']);
	assert.deepEqual(expandPreferredEndpointVariants('[2606:4700::6811:9316]:443#ipv6'), ['[2606:4700::6811:9316]:443#ipv6']);
	assert.deepEqual(expandPreferredEndpointVariants('*.example.com:443#wildcard'), ['*.example.com:443#wildcard']);
}

{
	const first = await createTunnelContext(fakeRequest({ colo: 'SJC' }), { PROXYIP: 'first.example.com' });
	const second = await createTunnelContext(fakeRequest({ colo: 'AMS' }), { PROXYIP: 'second.example.com' });

	await applyProxyParamsToTunnelContext(new URL('https://worker.example.com/proxyip=clean.example.com/ws'), '00000000-0000-4000-8000-000000000000', first);
	await applyProxyParamsToTunnelContext(new URL('https://worker.example.com/socks5=user:pass@socks.example.com:1080/ws?globalproxy=1'), '00000000-0000-4000-8000-000000000000', second);

	assert.equal(first.proxyIP, 'clean.example.com');
	assert.equal(first.proxyType, null);
	assert.equal(first.globalProxyEnabled, false);
	assert.equal(second.proxyIP, 'second.example.com');
	assert.equal(second.proxyType, 'socks5');
	assert.equal(second.globalProxyEnabled, true);
	assert.equal(second.parsedProxyAddress.hostname, 'socks.example.com');
}

{
	let liveCalls = 0;
	const env = {};
	const first = getProxyResolutionRecord(env, null, 'coalesce.example.com', 'target.example.com', '00000000-0000-4000-8000-000000000000', async () => {
		liveCalls++;
		await new Promise(resolve => setTimeout(resolve, 20));
		return [['198.51.100.10', 443]];
	});
	const second = getProxyResolutionRecord(env, null, 'coalesce.example.com', 'target.example.com', '00000000-0000-4000-8000-000000000000', async () => {
		liveCalls++;
		return [['198.51.100.11', 443]];
	});

	const [a, b] = await Promise.all([first, second]);
	assert.equal(liveCalls, 1, 'simultaneous cold proxy resolution should share one live lookup');
	assert.deepEqual(a.record.endpoints, [['198.51.100.10', 443]]);
	assert.deepEqual(b.record.endpoints, [['198.51.100.10', 443]]);
}

{
	let abortSeen = false;
	await assert.rejects(
		fetchWithTimeout('https://example.invalid/dns-query', { method: 'POST' }, 5, (_url, init) => new Promise((_, reject) => {
			init.signal.addEventListener('abort', () => {
				abortSeen = true;
				reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
			}, { once: true });
		})),
		/aborted/
	);
	assert.equal(abortSeen, true, 'timeout should abort the underlying fetch');
}

{
	const calls = [];
	const result = await openStaggeredCandidates([
		{ hostname: 'same.example.com', port: 443 },
		{ hostname: 'same.example.com', port: 443 },
	], async candidate => {
		calls.push(candidate);
		return { id: candidate.hostname, close() { this.closed = true; } };
	}, { staggerMs: 1 });

	assert.equal(calls.length, 1, 'duplicate host:port candidates should not be raced');
	assert.equal(result.candidate.hostname, 'same.example.com');
}

{
	const started = [];
	const result = await openStaggeredCandidates([
		{ hostname: 'slow.example.com', port: 443 },
		{ hostname: 'fast.example.com', port: 443 },
	], candidate => {
		started.push(candidate.hostname);
		if (candidate.hostname === 'slow.example.com') {
			return new Promise(resolve => setTimeout(() => resolve({ id: 'slow', close() { this.closed = true; } }), 50));
		}
		return Promise.resolve({ id: 'fast', close() { this.closed = true; } });
	}, { staggerMs: 5 });

	assert.deepEqual(started, ['slow.example.com', 'fast.example.com']);
	assert.equal(result.candidate.hostname, 'fast.example.com');
}

{
	const events = [];
	const webSocket = {
		readyState: WebSocket.OPEN,
		send() { events.push('send'); },
		close() {
			events.push('close');
			this.readyState = WebSocket.CLOSED;
		},
	};
	const remoteSocket = {
		readable: new ReadableStream({
			start(controller) {
				controller.error(new Error('early upstream failure'));
			},
		}),
	};

	await connectStreams(remoteSocket, webSocket, null, async () => {
		events.push('retry');
	});

	assert.deepEqual(events, ['retry'], 'early no-data read errors should retry before closing the client socket');
}

console.log('tunnel behavior tests passed');
