import { performance } from 'node:perf_hooks';
import http2 from 'node:http2';
import tls from 'node:tls';

function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith('--')) continue;
		const key = arg.slice(2);
		const next = argv[i + 1];
		out[key] = next && !next.startsWith('--') ? argv[++i] : '1';
	}
	return out;
}

function usage() {
	console.error([
		'Usage:',
		'  node scripts/live-tunnel-benchmark.mjs --url https://your-domain.example/ --uuid 00000000-0000-4000-8000-000000000000 --transports grpc,ws,xhttp',
		'',
		'Options:',
		'  --runs 5                 Number of requests per transport',
		'  --profile latency        latency, download, upload, or burst',
		'  --target example.com     Inner plain HTTP target reached through the tunnel',
		'  --port 80                Inner target port, not the Worker HTTPS port',
		'  --http-method GET        Inner HTTP method',
		'  --http-path /            Inner HTTP path, for example / or /files/1Mb.dat',
		'  --body-bytes 0           Deterministic upload body bytes for POST/upload tests',
		'  --concurrency 1          Concurrent runs per transport for burst checks',
		'  --ua "Mozilla/5.0 ..."   User-Agent',
		'  --timeout 15000          Per-run timeout in milliseconds',
		'  --transports all         all, grpc, ws, xhttp, or a comma-separated list',
		'  --front-host example.com gRPC only: connect to this clean/front host',
		'  --sni worker.example     gRPC only: TLS SNI/servername override',
		'  --authority worker.example gRPC only: HTTP/2 :authority override',
		'  --service-name /         gRPC only: request path/serviceName override',
	].join('\n'));
}

function uuidBytes(uuid) {
	const hex = String(uuid || '').replace(/-/g, '');
	if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error('UUID must be a valid UUID string');
	return new Uint8Array(hex.match(/../g).map(value => parseInt(value, 16)));
}

function concatBytes(chunks) {
	const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

function encodeVarint(value) {
	let remaining = Number(value) >>> 0;
	const bytes = [];
	while (remaining > 127) {
		bytes.push((remaining & 0x7f) | 0x80);
		remaining >>>= 7;
	}
	bytes.push(remaining);
	return new Uint8Array(bytes);
}

function readVarint(data, offset = 0) {
	let value = 0, shift = 0;
	for (let i = offset; i < data.byteLength; i++) {
		const current = data[i];
		value |= (current & 0x7f) << shift;
		if ((current & 0x80) === 0) return { value: value >>> 0, nextOffset: i + 1 };
		shift += 7;
		if (shift > 35) break;
	}
	throw new Error('Invalid protobuf varint');
}

function encodeGrpcFrame(payloads) {
	const fields = payloads.map(payload => {
		const data = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
		const len = encodeVarint(data.byteLength);
		const field = new Uint8Array(1 + len.byteLength + data.byteLength);
		field[0] = 0x0a;
		field.set(len, 1);
		field.set(data, 1 + len.byteLength);
		return field;
	});
	const message = concatBytes(fields);
	const frame = new Uint8Array(5 + message.byteLength);
	frame[0] = 0;
	frame[1] = (message.byteLength >>> 24) & 0xff;
	frame[2] = (message.byteLength >>> 16) & 0xff;
	frame[3] = (message.byteLength >>> 8) & 0xff;
	frame[4] = message.byteLength & 0xff;
	frame.set(message, 5);
	return frame;
}

function decodeGrpcPayloads(bytes) {
	const payloads = [];
	let offset = 0;
	while (bytes.byteLength - offset >= 5) {
		const length = ((bytes[offset + 1] << 24) >>> 0) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 8) | bytes[offset + 4];
		const frameEnd = offset + 5 + length;
		if (frameEnd > bytes.byteLength) break;
		let messageOffset = offset + 5;
		while (messageOffset < frameEnd) {
			if (bytes[messageOffset] !== 0x0a) break;
			const { value, nextOffset } = readVarint(bytes, messageOffset + 1);
			const payloadEnd = nextOffset + value;
			if (payloadEnd > frameEnd) break;
			if (value) payloads.push(bytes.subarray(nextOffset, payloadEnd));
			messageOffset = payloadEnd;
		}
		offset = frameEnd;
	}
	return payloads;
}

function makeVlessTcpRequest(uuid, hostname, port, rawData) {
	const hostBytes = new TextEncoder().encode(hostname);
	const raw = rawData instanceof Uint8Array ? rawData : new Uint8Array(rawData);
	const out = new Uint8Array(1 + 16 + 1 + 1 + 2 + 1 + 1 + hostBytes.byteLength + raw.byteLength);
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
	out.set(raw, offset);
	return out;
}

function stripVlessResponseHeader(bytes) {
	return bytes.byteLength >= 2 && bytes[0] === 0 && bytes[1] === 0 ? bytes.subarray(2) : bytes;
}

function hasVlessResponseHeader(bytes) {
	return bytes.byteLength >= 2 && bytes[0] === 0 && bytes[1] === 0;
}

function normalizeBenchmarkProfile(value) {
	const profile = String(value || 'latency').trim().toLowerCase();
	if (!['latency', 'download', 'upload', 'burst'].includes(profile)) {
		throw new Error(`Unsupported benchmark profile: ${value}`);
	}
	return profile;
}

function normalizeHttpMethod(value, profile) {
	const method = String(value || (profile === 'upload' ? 'POST' : 'GET')).trim().toUpperCase();
	if (!/^[A-Z]{1,16}$/.test(method)) throw new Error(`Invalid HTTP method: ${value}`);
	return method;
}

function normalizeHttpPath(value) {
	const path = String(value || '/').trim();
	if (!path.startsWith('/')) throw new Error(`HTTP path must start with /: ${value}`);
	if (/[\r\n]/.test(path)) throw new Error('HTTP path must not contain CR/LF');
	return path;
}

function normalizeByteCount(value, fallback = 0) {
	const parsed = Number(value ?? fallback);
	if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid byte count: ${value}`);
	return Math.min(16 * 1024 * 1024, Math.round(parsed));
}

function normalizePort(value) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`Invalid port: ${value}`);
	return parsed;
}

function makeDeterministicBody(size) {
	const body = new Uint8Array(size);
	for (let i = 0; i < body.byteLength; i++) body[i] = 97 + (i % 26);
	return body;
}

function makeHttpPayload({ uuid, target, port, ua, httpMethod = 'GET', httpPath = '/', bodyBytes = 0 }) {
	if (new TextEncoder().encode(target).byteLength > 255) throw new Error('Target hostname is too long for VLESS domain address');
	const body = makeDeterministicBody(bodyBytes);
	const headers = [
		`${httpMethod} ${httpPath} HTTP/1.1`,
		`Host: ${target}`,
		`User-Agent: ${ua}`,
		'Accept: */*',
		'Connection: close',
	];
	if (body.byteLength > 0 || httpMethod !== 'GET') headers.push(`Content-Length: ${body.byteLength}`);
	const head = new TextEncoder().encode(`${headers.join('\r\n')}\r\n\r\n`);
	const httpRequest = new Uint8Array(head.byteLength + body.byteLength);
	httpRequest.set(head, 0);
	httpRequest.set(body, head.byteLength);
	return makeVlessTcpRequest(uuid, target, port, httpRequest);
}

function normalizeTransports(value) {
	const raw = String(value || 'grpc').toLowerCase();
	const list = raw === 'all' ? ['grpc', 'ws', 'xhttp'] : raw.split(',').map(item => item.trim()).filter(Boolean);
	for (const item of list) {
		if (!['grpc', 'ws', 'xhttp'].includes(item)) throw new Error(`Unsupported transport: ${item}`);
	}
	return [...new Set(list)];
}

function parseHostPort(value, defaultPort = 443) {
	const text = String(value || '').trim();
	if (!text) return null;
	if (text.startsWith('[')) {
		const match = text.match(/^\[([^\]]+)\](?::(\d+))?$/);
		if (!match) throw new Error(`Invalid front host: ${value}`);
		return { hostname: match[1], port: Number(match[2] || defaultPort) };
	}
	const parts = text.split(':');
	if (parts.length > 2) throw new Error(`Invalid front host: ${value}`);
	return { hostname: parts[0], port: Number(parts[1] || defaultPort) };
}

async function collectResponseBody(response, startedAt, timeoutMs) {
	const reader = response.body.getReader();
	const chunks = [];
	let firstByteMs = null;
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const remaining = Math.max(1, deadline - Date.now());
		const { done, value } = await Promise.race([
			reader.read(),
			new Promise((_, reject) => setTimeout(() => reject(new Error('response read timed out')), remaining)),
		]);
		if (done) break;
		if (value && value.byteLength) {
			if (firstByteMs === null) firstByteMs = performance.now() - startedAt;
			chunks.push(new Uint8Array(value));
		}
	}
	try { reader.releaseLock(); } catch {}
	return { bytes: concatBytes(chunks), firstByteMs };
}

async function runGrpc(options) {
	const startedAt = performance.now();
	const targetUrl = new URL(options.url);
	if (targetUrl.protocol !== 'https:') throw new Error('gRPC benchmark requires an https:// URL');
	const authority = options.authority || targetUrl.host;
	const serviceName = options.serviceName || `${targetUrl.pathname || '/'}${targetUrl.search || ''}` || '/';
	const front = parseHostPort(options.frontHost, Number(targetUrl.port || 443));
	const connectHost = front?.hostname || targetUrl.hostname;
	const connectPort = front?.port || Number(targetUrl.port || 443);
	const servername = options.sni || targetUrl.hostname;
	const origin = `https://${authority}`;

	return await new Promise((resolve, reject) => {
		let settled = false;
		let status = 0;
		let firstByteMs = null;
		let timer = null;
		let req = null;
		const chunks = [];
		const client = http2.connect(origin, {
			createConnection: () => tls.connect({
				host: connectHost,
				port: connectPort,
				servername,
				ALPNProtocols: ['h2'],
			}),
		});
		const finish = (fn, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try { req?.close?.() } catch {}
			try { client.close(); } catch {}
			fn(value);
		};
		timer = setTimeout(() => {
			try { client.destroy(); } catch {}
			finish(reject, new Error('gRPC benchmark timed out'));
		}, options.timeoutMs);
		client.on('error', error => finish(reject, error));

		req = client.request({
			':method': 'POST',
			':scheme': 'https',
			':authority': authority,
			':path': serviceName,
			'content-type': 'application/grpc',
			'user-agent': options.ua,
			te: 'trailers',
		});
		req.on('response', headers => {
			status = Number(headers[':status'] || 0);
		});
		req.on('data', chunk => {
			if (chunk.byteLength) {
				if (firstByteMs === null) firstByteMs = performance.now() - startedAt;
				chunks.push(new Uint8Array(chunk));
			}
		});
		req.on('end', () => {
			const bodyBytes = concatBytes(chunks);
			const payloads = decodeGrpcPayloads(bodyBytes);
			const rawTunneled = concatBytes(payloads);
			const accepted = hasVlessResponseHeader(rawTunneled);
			const tunneled = stripVlessResponseHeader(rawTunneled);
			const text = new TextDecoder().decode(tunneled.subarray(0, 160));
			finish(resolve, summarizeRun('grpc', status, status >= 200 && status < 300, firstByteMs, startedAt, bodyBytes.byteLength, tunneled.byteLength, text, accepted));
		});
		req.on('error', error => finish(reject, error));
		req.write(Buffer.from(encodeGrpcFrame([makeHttpPayload(options)])));
	});
}

async function runXhttp(options) {
	const startedAt = performance.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs);
	try {
		const response = await fetch(options.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/octet-stream',
				'User-Agent': options.ua,
			},
			body: makeHttpPayload(options),
			signal: controller.signal,
		});
		const body = await collectResponseBody(response, startedAt, options.timeoutMs);
		const accepted = hasVlessResponseHeader(body.bytes);
		const tunneled = stripVlessResponseHeader(body.bytes);
		const text = new TextDecoder().decode(tunneled.subarray(0, 160));
		return summarizeRun('xhttp', response.status, response.ok, body.firstByteMs, startedAt, body.bytes.byteLength, tunneled.byteLength, text, accepted);
	} finally {
		clearTimeout(timer);
	}
}

async function websocketMessageBytes(data) {
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
	if (typeof data === 'string') return new TextEncoder().encode(data);
	return new Uint8Array(0);
}

async function runWs(options) {
	if (typeof WebSocket !== 'function') throw new Error('This Node.js runtime does not provide global WebSocket');
	const wsUrl = new URL(options.url);
	wsUrl.protocol = wsUrl.protocol === 'http:' ? 'ws:' : 'wss:';
	const startedAt = performance.now();
	const chunks = [];
	let firstByteMs = null;
	let status = 0;
	const result = await new Promise((resolve, reject) => {
		const ws = new WebSocket(wsUrl.href);
		ws.binaryType = 'arraybuffer';
		const pendingMessages = [];
		const timer = setTimeout(() => {
			try { ws.close(); } catch {}
			reject(new Error('websocket benchmark timed out'));
		}, options.timeoutMs);
		ws.addEventListener('open', () => {
			ws.send(makeHttpPayload(options));
		});
		ws.addEventListener('message', event => {
			const pending = Promise.resolve(websocketMessageBytes(event.data)).then(bytes => {
				if (bytes.byteLength) {
					if (firstByteMs === null) firstByteMs = performance.now() - startedAt;
					chunks.push(bytes);
				}
			});
			pendingMessages.push(pending);
			pending.catch(reject);
		});
		ws.addEventListener('close', () => {
			clearTimeout(timer);
			status = 101;
			Promise.allSettled(pendingMessages).then(() => resolve(concatBytes(chunks))).catch(reject);
		});
		ws.addEventListener('error', event => {
			clearTimeout(timer);
			reject(event.error || new Error('websocket error'));
		});
	});
	const accepted = hasVlessResponseHeader(result);
	const tunneled = stripVlessResponseHeader(result);
	const text = new TextDecoder().decode(tunneled.subarray(0, 160));
	return summarizeRun('ws', status, status === 101, firstByteMs, startedAt, result.byteLength, tunneled.byteLength, text, accepted);
}

function summarizeRun(transport, status, transportOk, firstByteMs, startedAt, bytes, tunneledBytes, text, accepted = false) {
	const totalMs = performance.now() - startedAt;
	return {
		transport,
		status,
		firstByteMs,
		totalMs,
		bytes,
		tunneledBytes,
		throughputMbps: totalMs > 0 ? Number(((tunneledBytes * 8) / totalMs / 1000).toFixed(3)) : null,
		accepted,
		ok: Boolean(transportOk && /HTTP\/1\.[01]\s+\d+/.test(text)),
	};
}

function percentile(values, p) {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[index];
}

function summarizeTransport(transport, results) {
	const successful = results.filter(result => result.ok);
	const accepted = results.filter(result => result.accepted);
	const firstByteValues = successful.map(result => result.firstByteMs).filter(value => Number.isFinite(value));
	const acceptedFirstByteValues = accepted.map(result => result.firstByteMs).filter(value => Number.isFinite(value));
	const totalValues = successful.map(result => result.totalMs).filter(value => Number.isFinite(value));
	const throughputValues = successful.map(result => result.throughputMbps).filter(value => Number.isFinite(value));
	return {
		transport,
		runs: results.length,
		accepted: accepted.length,
		acceptRate: results.length ? accepted.length / results.length : 0,
		successful: successful.length,
		successRate: results.length ? successful.length / results.length : 0,
		acceptedFirstByteP50Ms: acceptedFirstByteValues.length ? Math.round(percentile(acceptedFirstByteValues, 50)) : null,
		acceptedFirstByteP95Ms: acceptedFirstByteValues.length ? Math.round(percentile(acceptedFirstByteValues, 95)) : null,
		firstByteP50Ms: firstByteValues.length ? Math.round(percentile(firstByteValues, 50)) : null,
		firstByteP95Ms: firstByteValues.length ? Math.round(percentile(firstByteValues, 95)) : null,
		totalP50Ms: totalValues.length ? Math.round(percentile(totalValues, 50)) : null,
		totalP95Ms: totalValues.length ? Math.round(percentile(totalValues, 95)) : null,
		bytesAvg: successful.length ? Math.round(successful.reduce((sum, result) => sum + result.bytes, 0) / successful.length) : 0,
		tunneledBytesAvg: successful.length ? Math.round(successful.reduce((sum, result) => sum + (result.tunneledBytes || 0), 0) / successful.length) : 0,
		throughputP50Mbps: throughputValues.length ? Number(percentile(throughputValues, 50).toFixed(3)) : null,
		throughputP95Mbps: throughputValues.length ? Number(percentile(throughputValues, 95).toFixed(3)) : null,
	};
}

function applyProfileDefaults(options, explicitArgs) {
	if (options.profile === 'download') {
		if (!explicitArgs['http-path']) options.httpPath = '/';
		if (!explicitArgs.timeout) options.timeoutMs = Math.max(options.timeoutMs, 30000);
	}
	if (options.profile === 'upload') {
		if (!explicitArgs['http-method']) options.httpMethod = 'POST';
		if (!explicitArgs['body-bytes']) options.bodyBytes = 1024 * 1024;
		if (!explicitArgs.timeout) options.timeoutMs = Math.max(options.timeoutMs, 30000);
	}
	if (options.profile === 'burst') {
		if (!explicitArgs.concurrency) options.concurrency = 6;
		if (!explicitArgs.runs) options.runs = 24;
		if (!explicitArgs.timeout) options.timeoutMs = Math.max(options.timeoutMs, 20000);
	}
	return options;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
	usage();
	process.exit(0);
}

const url = args.url || process.env.TUNNEL_BENCH_URL || process.env.GRPC_BENCH_URL;
const uuid = args.uuid || process.env.TUNNEL_BENCH_UUID || process.env.GRPC_BENCH_UUID;
if (!url || !uuid) {
	usage();
	process.exit(2);
}

const profile = normalizeBenchmarkProfile(args.profile || process.env.TUNNEL_BENCH_PROFILE || 'latency');
const options = applyProfileDefaults({
	url,
	uuid,
	profile,
	target: args.target || process.env.TUNNEL_BENCH_TARGET || process.env.GRPC_BENCH_TARGET || 'example.com',
	port: normalizePort(args.port || process.env.TUNNEL_BENCH_PORT || process.env.GRPC_BENCH_PORT || 80),
	httpMethod: normalizeHttpMethod(args['http-method'] || args.method || process.env.TUNNEL_BENCH_HTTP_METHOD, profile),
	httpPath: normalizeHttpPath(args['http-path'] || args.path || process.env.TUNNEL_BENCH_HTTP_PATH || '/'),
	bodyBytes: normalizeByteCount(args['body-bytes'] || process.env.TUNNEL_BENCH_BODY_BYTES || 0),
	ua: args.ua || process.env.TUNNEL_BENCH_UA || process.env.GRPC_BENCH_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
	timeoutMs: Math.max(1000, Math.min(60000, Number(args.timeout || process.env.TUNNEL_BENCH_TIMEOUT || 15000))),
	concurrency: Math.max(1, Math.min(32, Math.round(Number(args.concurrency || process.env.TUNNEL_BENCH_CONCURRENCY || 1)))),
	runs: Math.max(1, Math.min(200, Number(args.runs || process.env.TUNNEL_BENCH_RUNS || process.env.GRPC_BENCH_RUNS || 5))),
	frontHost: args['front-host'] || args.front || process.env.TUNNEL_BENCH_FRONT_HOST || process.env.GRPC_BENCH_FRONT_HOST || '',
	sni: args.sni || process.env.TUNNEL_BENCH_SNI || process.env.GRPC_BENCH_SNI || '',
	authority: args.authority || process.env.TUNNEL_BENCH_AUTHORITY || process.env.GRPC_BENCH_AUTHORITY || '',
	serviceName: args['service-name'] || args.serviceName || process.env.TUNNEL_BENCH_SERVICE_NAME || process.env.GRPC_BENCH_SERVICE_NAME || '',
}, args);
const transports = normalizeTransports(args.transports || process.env.TUNNEL_BENCH_TRANSPORTS || 'grpc');
const runners = { grpc: runGrpc, ws: runWs, xhttp: runXhttp };
const allResults = [];

async function runOne(transport, run) {
	try {
		const result = await runners[transport](options);
		allResults.push(result);
		console.log(JSON.stringify({ run, profile: options.profile, ...result }));
	} catch (error) {
		const result = { transport, status: 0, firstByteMs: null, totalMs: null, bytes: 0, tunneledBytes: 0, throughputMbps: null, accepted: false, ok: false, error: error?.message || String(error) };
		allResults.push(result);
		console.log(JSON.stringify({ run, profile: options.profile, ...result }));
	}
}

for (const transport of transports) {
	for (let nextRun = 1; nextRun <= options.runs;) {
		const batch = [];
		for (let slot = 0; slot < options.concurrency && nextRun <= options.runs; slot++, nextRun++) {
			batch.push(runOne(transport, nextRun));
		}
		await Promise.all(batch);
	}
}

console.log(JSON.stringify({
	profile: options.profile,
	target: `${options.target}:${options.port}${options.httpPath}`,
	httpMethod: options.httpMethod,
	bodyBytes: options.bodyBytes,
	concurrency: options.concurrency,
	summary: transports.map(transport => summarizeTransport(transport, allResults.filter(result => result.transport === transport))),
}, null, 2));

if (!allResults.some(result => result.ok)) process.exit(1);
