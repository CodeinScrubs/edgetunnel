import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

globalThis.WebSocket = globalThis.WebSocket || { OPEN: 1, CLOSING: 2, CLOSED: 3 };

const workerModule = await import('../_worker.js');
const helpers = workerModule.__testPerformanceHelpers;

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
	handleGrpcRequest,
	encodeGrpcDataFrame,
	parseGrpcFrameChunk,
	unwrapGrpcMessagePayloads,
	getSubscriptionRequestOptions,
	finalizeSubscriptionContent,
	getTransportConfig,
	readConfigJson,
	translateHTMLVisibleText,
	injectEnglishRuntimeTranslator,
	buildRequestLogEntryKey,
	readRequestLogs,
	recordRequestLog,
	writeRequestLogEntry,
	isSpeedTestSite,
	matchesHostPattern,
	patchSingboxSubscription,
	patchSurgeSubscription,
	readGrpcFrameLength,
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

async function waitForCondition(predicate, timeoutMs, label) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (predicate()) return;
		await new Promise(resolve => setTimeout(resolve, 5));
	}
	throw new Error(`test harness timeout: ${label}`);
}

async function collectReadableStream(stream, timeoutMs = 1_000) {
	const reader = stream.getReader();
	const chunks = [];
	try {
		while (true) {
			const { done, value } = await withTestTimeout(reader.read(), timeoutMs, 'collect readable stream');
			if (done) break;
			if (value) chunks.push(new Uint8Array(value));
		}
	} finally {
		try { reader.releaseLock(); } catch {}
	}
	const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

function uuidBytes(uuid) {
	return new Uint8Array(uuid.replace(/-/g, '').match(/../g).map(hex => parseInt(hex, 16)));
}

function md5Hex(value) {
	return createHash('md5').update(String(value)).digest('hex').toLowerCase();
}

function md5md5(value) {
	return md5Hex(md5Hex(value).slice(7, 27));
}

function makeVlessTcpRequest(uuid, hostname = 'target.example', port = 443, rawData = new Uint8Array(0)) {
	const hostBytes = new TextEncoder().encode(hostname);
	const out = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1 + 1 + hostBytes.byteLength + rawData.byteLength);
	let offset = 0;
	out[offset++] = 0;
	out.set(uuidBytes(uuid), offset);
	offset += 16;
	out[offset++] = 0;
	out[offset++] = 1;
	out[offset++] = (port >> 8) & 0xff;
	out[offset++] = port & 0xff;
	out[offset++] = 2;
	out[offset++] = hostBytes.byteLength;
	out.set(hostBytes, offset);
	offset += hostBytes.byteLength;
	out.set(rawData, offset);
	return out;
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

function makeFakeKV(initialEntries = {}, options = {}) {
	const store = new Map(Object.entries(initialEntries));
	const puts = [];
	return {
		puts,
		store,
		async get(key) {
			const delayMs = options.getDelays?.[key] || 0;
			if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
			return store.has(key) ? store.get(key) : null;
		},
		async put(key, value, options) {
			puts.push({ key, value, options });
			store.set(key, value);
		},
		async list({ prefix = '', limit = 1000, cursor } = {}) {
			const offset = cursor ? Number(cursor) : 0;
			const names = [...store.keys()].filter(key => key.startsWith(prefix)).sort();
			const page = names.slice(offset, offset + limit);
			const nextOffset = offset + page.length;
			return {
				keys: page.map(name => ({ name })),
				list_complete: nextOffset >= names.length,
				cursor: nextOffset >= names.length ? undefined : String(nextOffset),
			};
		},
	};
}

{
	const first = encodeGrpcDataFrame(new Uint8Array([1, 2, 3]));
	const second = encodeGrpcDataFrame(new Uint8Array([4, 5]));
	const combined = new Uint8Array(first.byteLength + second.byteLength);
	combined.set(first, 0);
	combined.set(second, first.byteLength);
	const parsed = parseGrpcFrameChunk(new Uint8Array(0), combined);
	assert.deepEqual(parsed.payloads, [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]);
	assert.equal(parsed.pending.byteLength, 0);
}

{
	const message = new Uint8Array([0x0a, 0x01, 0xaa, 0x0a, 0x02, 0xbb, 0xcc]);
	const frame = new Uint8Array(5 + message.byteLength);
	frame[0] = 0;
	frame[4] = message.byteLength;
	frame.set(message, 5);
	const parsed = parseGrpcFrameChunk(new Uint8Array(0), frame);
	assert.deepEqual(parsed.payloads, [new Uint8Array([0xaa]), new Uint8Array([0xbb, 0xcc])], 'multi-mode protobuf messages should yield each bytes field as a separate payload');
}

{
	const frame = encodeGrpcDataFrame(new Uint8Array([9, 8, 7, 6]));
	const firstHalf = parseGrpcFrameChunk(new Uint8Array(0), frame.subarray(0, 4));
	assert.equal(firstHalf.payloads.length, 0);
	assert.equal(firstHalf.pending.byteLength, 4);
	const secondHalf = parseGrpcFrameChunk(firstHalf.pending, frame.subarray(4));
	assert.deepEqual(secondHalf.payloads, [new Uint8Array([9, 8, 7, 6])]);
	assert.equal(secondHalf.pending.byteLength, 0);
}

{
	const emptyFrame = new Uint8Array([0, 0, 0, 0, 0]);
	const parsed = parseGrpcFrameChunk(new Uint8Array(0), emptyFrame);
	assert.deepEqual(parsed.payloads, []);
	assert.equal(parsed.pending.byteLength, 0);
}

{
	assert.throws(
		() => parseGrpcFrameChunk(new Uint8Array(0), new Uint8Array([0, 1, 0, 0, 1])),
		/gRPC frame too large/
	);
	assert.throws(
		() => unwrapGrpcMessagePayloads(new Uint8Array([0x0a, 0x05, 0x01])),
		/Invalid gRPC protobuf wrapper/
	);
}

{
	const gun = getTransportConfig({ 传输协议: 'grpc', gRPC模式: 'gun' });
	const multi = getTransportConfig({ 传输协议: 'grpc', gRPC模式: 'multi' });
	assert.equal(gun.type, 'grpc&mode=gun&alpn=h2');
	assert.equal(multi.type, 'grpc&mode=multi&alpn=h2');
	assert.equal(gun.路径字段名, 'serviceName');
	assert.equal(gun.域名字段名, 'authority');
}

{
	const uuid = '11111111-1111-4111-8111-111111111111';
	const baseConfig = {
		UUID: uuid,
		HOST: 'worker.example',
		HOSTS: ['worker.example'],
		PATH: '/',
		协议类型: 'vless',
		传输协议: 'grpc',
		gRPC模式: 'gun',
		gRPCUserAgent: 'UnitTest/1.0',
		跳过证书验证: false,
		启用0RTT: false,
		TLS分片: null,
		随机路径: false,
		ECH: false,
		ECHConfig: { DNS: 'https://dns.example/dns-query', SNI: 'cloudflare-ech.com' },
		SS: { 加密方式: 'aes-128-gcm', TLS: true },
		Fingerprint: 'chrome',
		优选订阅生成: { local: true, 本地IP库: { 随机IP: false, 随机数量: 1, 指定端口: -1 }, SUB: null, SUBNAME: 'edge', SUBUpdateTime: 3 },
		订阅转换配置: { SUBAPI: 'https://sub.example', SUBCONFIG: '', SUBEMOJI: false },
		反代: { PROXYIP: 'auto', SOCKS5: { 启用: null, 全局: false, 账号: null, 白名单: [] }, 路径模板: { PROXYIP: 'proxyip={{IP:PORT}}' } },
		TG: { 启用: false },
		CF: { Usage: { success: false, pages: 0, workers: 0, total: 0, max: 100000 } },
	};
	for (const mode of ['gun', 'multi']) {
		const config = await readConfigJson({ KV: makeFakeKV({ 'config.json': JSON.stringify({ ...baseConfig, gRPC模式: mode }) }) }, 'worker.example', uuid, 'UnitTest/1.0');
		assert.equal(config.LINK.includes(`type=grpc&mode=${mode}&alpn=h2`), true);
		assert.equal(config.LINK.includes('authority=worker.example'), true);
		assert.equal(config.LINK.includes('serviceName=%2F'), true);
	}
}

{
	const uuid = '11111111-1111-4111-8111-111111111111';
	const config = await readConfigJson({
		KV: makeFakeKV({
			'config.json': JSON.stringify({
				UUID: uuid,
				HOST: 'worker.example',
				HOSTS: ['worker.example'],
			}),
		}),
	}, 'worker.example', uuid, 'UnitTest/1.0');

	assert.equal(config.HOST, 'worker.example');
	assert.equal(config.传输协议, 'ws');
	assert.equal(config.反代.PROXYIP, 'auto');
	assert.equal(config.优选订阅生成.SUBNAME, 'edgetunnel');
	assert.equal(config.LINK.includes(`vless://${uuid}@worker.example:443`), true);
}

{
	const uuid = '11111111-1111-4111-8111-111111111111';
	const [alpha, beta] = await Promise.all([
		readConfigJson({ KV: makeFakeKV({}, { getDelays: { 'tg.json': 25 } }), HOST: 'alpha.example' }, 'alpha.example', uuid, 'UA-A'),
		readConfigJson({ KV: makeFakeKV({}), HOST: 'beta.example' }, 'beta.example', uuid, 'UA-B'),
	]);
	assert.equal(alpha.HOST, 'alpha.example');
	assert.deepEqual(alpha.HOSTS, ['alpha.example']);
	assert.equal(alpha.gRPCUserAgent, 'UA-A');
	assert.equal(beta.HOST, 'beta.example');
	assert.deepEqual(beta.HOSTS, ['beta.example']);
	assert.equal(beta.gRPCUserAgent, 'UA-B');
}

{
	const translated = translateHTMLVisibleText('<html lang="zh-CN"><body><button title="保存配置">保存配置</button><p>请稍候</p><script>const label="保存配置";</script></body></html>');
	const visibleHtml = translated.replace(/<script\b[\s\S]*?<\/script>/gi, '');
	assert.equal(translated.includes('lang="en"'), true);
	assert.equal(/[\u3400-\u9fff\uf900-\ufaff]/.test(visibleHtml), false, 'visible translated HTML should not leak non-English Han text');
	assert.equal(translated.includes('<script>const label="保存配置";</script>'), true, 'script contents should not be rewritten server-side');
}

{
	const translated = translateHTMLVisibleText('<html><body><template><section aria-label="网络环境"><button title="清空列表" data-tip="端口为 0 时，随机设置 443、2053、2083、2087、2096、8443 端口。">清空列表</button><p>在线优选</p></section></template></body></html>');
	assert.equal(/[\u3400-\u9fff\uf900-\ufaff]/.test(translated), false, 'template UI text should be translated before client-side rendering');
}

{
	const injected = injectEnglishRuntimeTranslator('<html><body><p>保存配置</p></body></html>');
	const scriptMatch = injected.match(/<script data-english-runtime-translator>([\s\S]*?)<\/script>/);
	assert.ok(scriptMatch, 'runtime translator script should be injected');
	assert.equal(/[\u3400-\u9fff\uf900-\ufaff]/.test(scriptMatch[1]), false, 'runtime translator script should escape raw non-English text');
	new Function(scriptMatch[1]);
}

function fakeLogRequest(url = 'https://worker.example/sub?token=redacted') {
	return {
		cf: { asn: 13335, asOrganization: 'Cloudflare', country: 'US', city: 'Austin' },
		url,
		headers: {
			get(name) {
				if (String(name).toLowerCase() === 'user-agent') return 'UnitTest/1.0';
				return null;
			},
		},
	};
}

{
	const firstKey = buildRequestLogEntryKey(1000, 'a');
	const secondKey = buildRequestLogEntryKey(2000, 'b');
	assert.equal(firstKey < secondKey, false, 'newer log keys should sort before older keys');
	assert.equal(firstKey.startsWith('log:entry:'), true);
}

{
	const kv = makeFakeKV();
	await writeRequestLogEntry({ KV: kv }, { TYPE: 'Get_SUB', TIME: 1000, URL: 'https://worker.example/a' }, 'Get_SUB', 1000);
	await writeRequestLogEntry({ KV: kv }, { TYPE: 'Get_SUB', TIME: 1001, URL: 'https://worker.example/b' }, 'Get_SUB', 1001);

	assert.equal(kv.puts.filter(call => call.key.startsWith('log:entry:')).length, 2);
	assert.equal(kv.puts.some(call => call.key === 'log.json'), false, 'append-only logging must not write the legacy shared log.json key');
}

{
	const kv = makeFakeKV();
	await writeRequestLogEntry({ KV: kv }, { TYPE: 'Get_SUB', TIME: 1000, URL: 'https://worker.example/old' }, 'Get_SUB', 1000);
	await writeRequestLogEntry({ KV: kv }, { TYPE: 'Get_SUB', TIME: 2000, URL: 'https://worker.example/new' }, 'Get_SUB', 2000);

	const logs = await readRequestLogs({ KV: kv }, { limit: 10 });
	assert.deepEqual(logs.map(log => log.URL), ['https://worker.example/new', 'https://worker.example/old']);
}

{
	const legacy = JSON.stringify([{ TYPE: 'Legacy', TIME: 1, URL: 'https://worker.example/legacy' }]);
	const kv = makeFakeKV({ 'log.json': legacy });
	const logs = await readRequestLogs({ KV: kv }, { limit: 10 });
	assert.deepEqual(logs, JSON.parse(legacy));
}

{
	const kv = makeFakeKV();
	await recordRequestLog({ KV: kv }, { url: 'https://worker.example/sub', headers: { get: () => null } }, '203.0.113.55', 'Get_SUB', { TG: { 启用: false } }, true);
	const logs = await readRequestLogs({ KV: kv }, { limit: 10 });
	assert.equal(logs.length, 1, 'request logs should be written even when request.cf is unavailable');
	assert.equal(logs[0].ASN, 'AS0 Unknown');
	assert.equal(logs[0].CC, 'N/A N/A');
}

{
	const kv = makeFakeKV();
	await recordRequestLog({ KV: kv, OFF_LOG: '1' }, fakeLogRequest(), '203.0.113.10', 'Get_SUB', { TG: { 启用: false } }, true);
	assert.equal(kv.puts.length, 0, 'OFF_LOG should disable KV log writes');
}

{
	const ua = 'UnitTest/1.0';
	const admin = 'test-admin-password';
	const key = 'default-key-change-with-KEY-env-if-needed';
	const env = { ADMIN: admin, UUID: '11111111-1111-4111-8111-111111111111', KV: makeFakeKV({ 'ADD.txt': '203.0.113.1' }) };
	const headers = { 'User-Agent': ua, Cookie: `auth=${md5md5(ua + key + admin)}` };
	const ctx = { waitUntil() {} };

	const addResponse = await workerModule.default.fetch(new Request('https://worker.example/admin/ADD.txt', { headers }), env, ctx);
	assert.equal(addResponse.status, 200);
	assert.equal(addResponse.headers.get('asn'), '0');
	assert.equal(await addResponse.text(), '203.0.113.1');

	const cfResponse = await workerModule.default.fetch(new Request('https://worker.example/admin/cf.json', { headers }), env, ctx);
	assert.equal(cfResponse.status, 200);
	assert.deepEqual(JSON.parse(await cfResponse.text()), {});
}

{
	const kv = makeFakeKV();
	const config = { TG: { 启用: false } };
	const request = fakeLogRequest('https://worker.example/admin/saveConfig');
	await recordRequestLog({ KV: kv }, request, '203.0.113.10', 'Save_Config', config, true);
	await recordRequestLog({ KV: kv }, request, '203.0.113.10', 'Save_Config', config, true);

	assert.equal(kv.puts.filter(call => call.key.startsWith('log:entry:')).length, 1, 'duplicate non-subscription admin logs should be throttled');
	assert.equal(kv.puts.some(call => call.key.startsWith('log:dedupe:')), true);
}

{
	assert.deepEqual(expandPreferredEndpointVariants('speedtest.net'), ['speedtest.net', 'www.speedtest.net']);
	assert.deepEqual(expandPreferredEndpointVariants('www.speedtest.net'), ['www.speedtest.net', 'speedtest.net']);
	assert.deepEqual(expandPreferredEndpointVariants('example.com:8443#edge'), ['example.com:8443#edge', 'www.example.com:8443#edge']);
	assert.deepEqual(expandPreferredEndpointVariants('cdn.example.com:8443#sub'), ['cdn.example.com:8443#sub']);
	assert.deepEqual(expandPreferredEndpointVariants('104.21.105.47:443#ip'), ['104.21.105.47:443#ip']);
	assert.deepEqual(expandPreferredEndpointVariants('[2606:4700::6811:9316]:443#ipv6'), ['[2606:4700::6811:9316]:443#ipv6']);
	assert.deepEqual(expandPreferredEndpointVariants('*.example.com:443#wildcard'), ['*.example.com:443#wildcard']);
}

{
	const headers = { get: () => null };
	const clashBase64 = getSubscriptionRequestOptions(new URL('https://worker.example/sub?target=clash&base64'), { headers }, 'mozilla', false);
	assert.equal(clashBase64.type, 'clash');
	assert.equal(clashBase64.shouldBase64Subscription, true);
	assert.equal(clashBase64.isSubConverterRequest, false);

	const rawBase64 = getSubscriptionRequestOptions(new URL('https://worker.example/sub?base64'), { headers }, 'mozilla', false);
	assert.equal(rawBase64.type, 'mixed');
	assert.equal(rawBase64.shouldBase64Subscription, true);

	const converter = getSubscriptionRequestOptions(new URL('https://worker.example/sub?target=clash'), {
		headers: { get: name => String(name).toLowerCase() === 'subconverter-request' ? '1' : null },
	}, 'clash', false);
	assert.equal(converter.type, 'mixed');
	assert.equal(converter.isSubConverterRequest, true);
}

{
	assert.equal(isSpeedTestSite('speed.cloudflare.com'), true);
	assert.equal(isSpeedTestSite('SPEED.CLOUDFLARE.COM'), true);
	assert.equal(isSpeedTestSite('edge.speed.cloudflare.com'), true);
	assert.equal(isSpeedTestSite('not-speed.cloudflare.com.example'), false);
}

{
	assert.equal(matchesHostPattern('api.example.com', '*.example.com'), true);
	assert.equal(matchesHostPattern('badexample.com', '*.example.com'), false);
	assert.equal(matchesHostPattern('xexampleycom', '*.example.com'), false);
	assert.equal(matchesHostPattern('media.tapecontent.net', '*tapecontent.net'), true);
	assert.equal(matchesHostPattern('media.tapecontentXnet', '*tapecontent.net'), false);
}

{
	assert.equal(readGrpcFrameLength(new Uint8Array([0, 0, 0, 0, 1])), 1);
	assert.throws(
		() => readGrpcFrameLength(new Uint8Array([0, 1, 0, 0, 1])),
		/gRPC frame too large/
	);
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
	const content = [
		'- name: generated',
		'  type: vless',
		'  server: front.example.com',
		'  uuid: 00000000-0000-4000-8000-000000000000',
		'  servername: example.com',
		'  ws-opts:',
		'    headers:',
		'      Host: example.com',
	].join('\n');
	const result = finalizeSubscriptionContent(content, {
		UUID: '11111111-1111-4111-8111-111111111111',
		HOSTS: ['worker-one.example.net', 'worker-two.example.net'],
	});
	const servername = result.match(/servername:\s*([^\n]+)/)?.[1]?.trim();
	const hostHeader = result.match(/Host:\s*([^\n]+)/)?.[1]?.trim();

	assert.equal(servername, hostHeader, 'generated multi-line node must use the same host for servername and Host header');
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
	const originalConsoleError = console.error;
	const capturedErrors = [];
	console.error = (...args) => capturedErrors.push(args);
	try {
		await assert.doesNotReject(async () => {
			const result = await patchSingboxSubscription('{ this is not json', { UUID: '11111111-1111-4111-8111-111111111111' });
			assert.equal(result, '{ this is not json');
		});
	} finally {
		console.error = originalConsoleError;
	}
	assert.equal(capturedErrors.length, 1, 'invalid Singbox JSON should be logged once without throwing');
}

{
	assert.doesNotThrow(() => {
		const result = patchSurgeSubscription('node = trojan, front.example.com, 443, password=pw, skip-cert-verify=false', 'https://worker.example/sub', {
			随机路径: false,
			完整节点路径: '/',
			跳过证书验证: false,
			优选订阅生成: { SUBUpdateTime: 3 },
		});
		assert.equal(result.includes('#!MANAGED-CONFIG https://worker.example/sub'), true);
	});
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
	const writes = [];
	let closed = false;
	const chunks = [
		new Uint8Array([0x05]),
		new Uint8Array([0x00]),
		new Uint8Array([0x05]),
		new Uint8Array([0x00, 0x00, 0x01]),
		new Uint8Array([127, 0, 0, 1, 0x04, 0x38]),
	];
	const socket = {
		opened: Promise.resolve(),
		readable: new ReadableStream({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(chunk);
			},
		}),
		writable: new WritableStream({
			write(chunk) {
				writes.push(new Uint8Array(chunk));
			},
		}),
		closed: new Promise(() => {}),
		close() {
			closed = true;
		},
	};
	const result = await withTestTimeout(
		socks5Connect('target.example', 443, new Uint8Array([0xaa, 0xbb]), () => socket, { hostname: 'proxy.example', port: 1080, timeoutMs: 400 }),
		1_000,
		'SOCKS5 split handshake'
	);
	assert.equal(result, socket);
	assert.equal(closed, false, 'valid split SOCKS5 handshake should not close the socket');
	assert.deepEqual(writes[0], new Uint8Array([0x05, 0x01, 0x00]));
	assert.deepEqual(writes[1], new Uint8Array([0x05, 0x01, 0x00, 0x03, 14, 116, 97, 114, 103, 101, 116, 46, 101, 120, 97, 109, 112, 108, 101, 0x01, 0xbb]));
	assert.deepEqual(writes[2], new Uint8Array([0xaa, 0xbb]));
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

{
	const uuid = '11111111-1111-4111-8111-111111111111';
	let upstreamClosed = false;
	let requestBodyCanceled = false;
	const upstreamWrites = [];
	const socket = {
		opened: Promise.resolve(),
		readable: new ReadableStream({}),
		writable: new WritableStream({
			write(chunk) {
				upstreamWrites.push(new Uint8Array(chunk));
			},
		}),
		closed: new Promise(() => {}),
		close() {
			upstreamClosed = true;
		},
	};
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(encodeGrpcDataFrame(makeVlessTcpRequest(uuid, 'target.example', 443, new Uint8Array([0xaa]))));
		},
		cancel() {
			requestBodyCanceled = true;
		},
	});
	const response = await handleGrpcRequest({
		body,
		cf: {},
		headers: { get: () => null },
		fetcher: { connect: () => socket },
	}, uuid);
	const reader = response.body.getReader();
	await waitForCondition(() => upstreamWrites.length > 0, 300, 'gRPC upstream connection should receive first payload');
	await reader.cancel();
	assert.equal(upstreamClosed, true, 'gRPC response cancellation should close upstream socket');
	assert.equal(requestBodyCanceled, true, 'gRPC response cancellation should cancel request body reads');
}

{
	const uuid = '11111111-1111-4111-8111-111111111111';
	let upstreamClosed = false;
	let requestBodyCanceled = false;
	const socket = {
		opened: Promise.resolve(),
		readable: new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array([0xbb]));
				controller.close();
			},
		}),
		writable: new WritableStream(),
		closed: Promise.resolve(),
		close() {
			upstreamClosed = true;
		},
	};
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(encodeGrpcDataFrame(makeVlessTcpRequest(uuid, 'target.example', 443, new Uint8Array([0xaa]))));
		},
		cancel() {
			requestBodyCanceled = true;
		},
	});
	const response = await handleGrpcRequest({
		body,
		cf: {},
		headers: { get: () => null },
		fetcher: { connect: () => socket },
	}, uuid);
	const bytes = await collectReadableStream(response.body);
	const parsed = parseGrpcFrameChunk(new Uint8Array(0), bytes);
	assert.deepEqual(parsed.payloads.map(payload => [...payload]), [[0, 0], [0xbb]]);
	await waitForCondition(() => requestBodyCanceled, 300, 'gRPC upstream EOF should cancel open request body');
	assert.equal(upstreamClosed, true, 'gRPC upstream EOF should close upstream socket');
}

{
	const uuid = '11111111-1111-4111-8111-111111111111';
	let requestBodyCanceled = false;
	const socket = {
		opened: Promise.resolve(),
		readable: new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array([0xcc]));
				controller.close();
			},
		}),
		writable: new WritableStream(),
		closed: Promise.resolve(),
		close() {},
	};
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(makeVlessTcpRequest(uuid, 'target.example', 443, new Uint8Array([0xaa])));
		},
		cancel() {
			requestBodyCanceled = true;
		},
	});
	const response = await workerModule.default.fetch({
		url: 'https://worker.example/tunnel',
		method: 'POST',
		headers: { get: () => null },
		body,
		cf: {},
		fetcher: { connect: () => socket },
	}, { ADMIN: 'admin-password', UUID: uuid }, { waitUntil() {} });

	const bytes = await collectReadableStream(response.body);
	assert.deepEqual([...bytes], [0, 0, 0xcc]);
	await waitForCondition(() => requestBodyCanceled, 300, 'XHTTP upstream EOF should cancel open request body');
}

console.log('tunnel behavior tests passed');
