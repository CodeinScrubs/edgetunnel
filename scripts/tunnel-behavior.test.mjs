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
	forwardataudp,
	socks5Connect,
	httpConnect,
	httpsConnect,
	finalizeSubscriptionContent,
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

function withTestTimeout(promise, timeoutMs, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error(`test harness timeout: ${label}`)), timeoutMs)),
	]);
}

function makeHangingProxySocket({ opened = Promise.resolve(), readableCancel = () => {} } = {}) {
	let closed = false;
	const socket = {
		opened,
		readable: new ReadableStream({
			cancel(reason) {
				readableCancel(reason);
			},
		}),
		writable: new WritableStream({
			write() {},
		}),
		closed: new Promise(() => {}),
		close() {
			closed = true;
		},
		get closedFlag() {
			return closed;
		},
	};
	return socket;
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
	const content = [
		'vless://00000000-0000-4000-8000-000000000000@front.example.com:443?security=tls&type=ws&host=example.com&fp=chrome&sni=example.com&path=%2F&encryption=none#front.example.com',
		'vless://external-user@front.example.com:443?security=tls&type=ws&host=origin.example.com&sni=origin.example.com&path=%2F#external',
	].join('\n');
	const result = finalizeSubscriptionContent(content, {
		UUID: '11111111-1111-4111-8111-111111111111',
		HOSTS: ['worker.example.net'],
	});
	const [generated, external] = result.split('\n');

	assert.equal(generated.includes('11111111-1111-4111-8111-111111111111@front.example.com:443'), true);
	assert.equal(generated.includes('host=worker.example.net'), true);
	assert.equal(generated.includes('sni=worker.example.net'), true);
	assert.equal(generated.includes('#front.example.com'), true);
	assert.equal(external.includes('front.example.com:443'), true);
	assert.equal(external.includes('host=origin.example.com'), true);
	assert.equal(external.includes('sni=origin.example.com'), true);
}

{
	const content = 'ss://MDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAw@front.example.com:443?plugin=v2ray-plugin%3Bmode%3Dwebsocket%3Bhost%3Dexample.com%3Bpath%3D%252F%3Btls#ss-node';
	const result = finalizeSubscriptionContent(content, {
		UUID: '11111111-1111-4111-8111-111111111111',
		HOSTS: ['worker.example.net'],
	});

	assert.equal(result.includes('front.example.com:443'), true);
	assert.equal(result.includes(btoa('11111111-1111-4111-8111-111111111111')), true);
	assert.equal(result.includes('host%3Dworker.example.net%3Bpath'), true);
}

{
	const content = [
		'- name: generated',
		'  type: vless',
		'  server: front.example.com',
		'  uuid: 00000000-0000-4000-8000-000000000000',
		'  servername: example.com',
		'  ws-opts:',
		'    headers:',
		'      Host: example.com',
		'- name: external',
		'  type: vless',
		'  server: front.example.com',
		'  uuid: external-user',
		'  servername: origin.example.com',
		'  ws-opts:',
		'    headers:',
		'      Host: origin.example.com',
	].join('\n');
	const result = finalizeSubscriptionContent(content, {
		UUID: '11111111-1111-4111-8111-111111111111',
		HOSTS: ['worker.example.net'],
	});

	assert.equal(result.includes('server: front.example.com'), true);
	assert.equal(result.includes('uuid: 11111111-1111-4111-8111-111111111111'), true);
	assert.equal(result.includes('servername: worker.example.net'), true);
	assert.equal(result.includes('Host: worker.example.net'), true);
	assert.equal(result.includes('uuid: external-user'), true);
	assert.equal(result.includes('servername: origin.example.com'), true);
	assert.equal(result.includes('Host: origin.example.com'), true);
}

{
	const content = JSON.stringify({
		outbounds: [
			{
				type: 'vless',
				server: 'front.example.com',
				uuid: '00000000-0000-4000-8000-000000000000',
				tls: { server_name: 'example.com' },
				transport: { type: 'ws', headers: { Host: 'example.com' } },
			},
			{
				type: 'vless',
				server: 'front.example.com',
				uuid: 'external-user',
				tls: { server_name: 'origin.example.com' },
				transport: { type: 'ws', headers: { Host: 'origin.example.com' } },
			},
		],
	});
	const result = finalizeSubscriptionContent(content, {
		UUID: '11111111-1111-4111-8111-111111111111',
		HOSTS: ['worker.example.net'],
	});
	const parsed = JSON.parse(result);

	assert.equal(parsed.outbounds[0].server, 'front.example.com');
	assert.equal(parsed.outbounds[0].uuid, '11111111-1111-4111-8111-111111111111');
	assert.equal(parsed.outbounds[0].tls.server_name, 'worker.example.net');
	assert.equal(parsed.outbounds[0].transport.headers.Host, 'worker.example.net');
	assert.equal(parsed.outbounds[1].server, 'front.example.com');
	assert.equal(parsed.outbounds[1].uuid, 'external-user');
	assert.equal(parsed.outbounds[1].tls.server_name, 'origin.example.com');
	assert.equal(parsed.outbounds[1].transport.headers.Host, 'origin.example.com');
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
				controller.enqueue(new Uint8Array([1, 2, 3]));
				controller.close();
			},
		}),
	};

	await connectStreams(remoteSocket, webSocket, null, null);

	assert.deepEqual(events, ['send', 'close'], 'normal upstream EOF after data should close the client bridge');
}

{
	let upstreamClosed = false;
	const writes = [];
	const sent = [];
	const responseFrame = new Uint8Array([0, 3, 0xaa, 0xbb, 0xcc]);
	const tcpSocket = {
		opened: Promise.resolve(),
		readable: new ReadableStream({
			start(controller) {
				controller.enqueue(responseFrame);
			},
		}),
		writable: new WritableStream({
			write(chunk) {
				writes.push(new Uint8Array(chunk));
			},
		}),
		closed: new Promise(() => {}),
		close() {
			upstreamClosed = true;
		},
	};
	const request = {
		fetcher: {
			connect() {
				return tcpSocket;
			},
		},
	};
	const webSocket = {
		readyState: WebSocket.OPEN,
		send(payload) {
			sent.push(new Uint8Array(payload));
		},
	};

	await withTestTimeout(forwardataudp(new Uint8Array([0, 2, 0x12, 0x34]), webSocket, new Uint8Array([0, 0]), request), 80, 'DNS TCP response should not wait for upstream close');

	assert.deepEqual(writes, [new Uint8Array([0, 2, 0x12, 0x34])]);
	assert.deepEqual(sent, [new Uint8Array([0, 0, 0, 3, 0xaa, 0xbb, 0xcc])]);
	assert.equal(upstreamClosed, true, 'DNS TCP socket should be closed after one complete response frame');
}

{
	let canceled = false;
	const socket = makeHangingProxySocket({ readableCancel: () => { canceled = true; } });
	await assert.rejects(
		withTestTimeout(socks5Connect('target.example', 443, null, () => socket, { hostname: 'proxy.example', port: 1080, timeoutMs: 400 }), 1_000, 'SOCKS5 handshake timeout'),
		/SOCKS5 proxy handshake timed out/
	);
	assert.equal(socket.closedFlag, true, 'SOCKS5 timeout should close the proxy socket');
	assert.equal(canceled, true, 'SOCKS5 timeout should cancel the pending read');
}

{
	let canceled = false;
	const socket = makeHangingProxySocket({ readableCancel: () => { canceled = true; } });
	await assert.rejects(
		withTestTimeout(httpConnect('target.example', 443, null, false, () => socket, { hostname: 'proxy.example', port: 8080, timeoutMs: 400 }), 1_000, 'HTTP CONNECT timeout'),
		/HTTP proxy CONNECT response timed out/
	);
	assert.equal(socket.closedFlag, true, 'HTTP timeout should close the proxy socket');
	assert.equal(canceled, true, 'HTTP timeout should cancel the pending read');
}

{
	const socket = makeHangingProxySocket({ opened: new Promise(() => {}) });
	await assert.rejects(
		withTestTimeout(httpsConnect('target.example', 443, null, () => socket, { hostname: 'proxy.example', port: 8443, timeoutMs: 400 }), 1_000, 'HTTPS proxy TCP timeout'),
		/HTTPS proxy TCP connect timed out/
	);
	assert.equal(socket.closedFlag, true, 'HTTPS timeout should close the proxy socket');
}

console.log('tunnel behavior tests passed');
