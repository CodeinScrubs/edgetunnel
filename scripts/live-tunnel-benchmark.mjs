import { performance } from 'node:perf_hooks';

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
		'  --target example.com     Plain HTTP target reached through the tunnel',
		'  --port 80                Target port',
		'  --ua "Mozilla/5.0 ..."   User-Agent',
		'  --timeout 15000          Per-run timeout in milliseconds',
		'  --transports all         all, grpc, ws, xhttp, or a comma-separated list',
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

function makeHttpPayload({ uuid, target, port, ua }) {
	const httpRequest = new TextEncoder().encode(`GET / HTTP/1.1\r\nHost: ${target}\r\nUser-Agent: ${ua}\r\nConnection: close\r\n\r\n`);
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
	const response = await fetch(options.url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/grpc',
			'User-Agent': options.ua,
		},
		body: encodeGrpcFrame([makeHttpPayload(options)]),
	});
	const body = await collectResponseBody(response, startedAt, options.timeoutMs);
	const payloads = decodeGrpcPayloads(body.bytes);
	const tunneled = concatBytes(payloads.slice(1));
	const text = new TextDecoder().decode(tunneled.subarray(0, 160));
	return summarizeRun('grpc', response.status, response.ok, body.firstByteMs, startedAt, body.bytes.byteLength, text);
}

async function runXhttp(options) {
	const startedAt = performance.now();
	const response = await fetch(options.url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/octet-stream',
			'User-Agent': options.ua,
		},
		body: makeHttpPayload(options),
	});
	const body = await collectResponseBody(response, startedAt, options.timeoutMs);
	const text = new TextDecoder().decode(stripVlessResponseHeader(body.bytes).subarray(0, 160));
	return summarizeRun('xhttp', response.status, response.ok, body.firstByteMs, startedAt, body.bytes.byteLength, text);
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
		const timer = setTimeout(() => {
			try { ws.close(); } catch {}
			reject(new Error('websocket benchmark timed out'));
		}, options.timeoutMs);
		ws.addEventListener('open', () => {
			ws.send(makeHttpPayload(options));
		});
		ws.addEventListener('message', event => {
			Promise.resolve(websocketMessageBytes(event.data)).then(bytes => {
				if (bytes.byteLength) {
					if (firstByteMs === null) firstByteMs = performance.now() - startedAt;
					chunks.push(bytes);
				}
			}).catch(reject);
		});
		ws.addEventListener('close', () => {
			clearTimeout(timer);
			status = 101;
			resolve(concatBytes(chunks));
		});
		ws.addEventListener('error', event => {
			clearTimeout(timer);
			reject(event.error || new Error('websocket error'));
		});
	});
	const text = new TextDecoder().decode(stripVlessResponseHeader(result).subarray(0, 160));
	return summarizeRun('ws', status, status === 101, firstByteMs, startedAt, result.byteLength, text);
}

function summarizeRun(transport, status, transportOk, firstByteMs, startedAt, bytes, text) {
	const totalMs = performance.now() - startedAt;
	return {
		transport,
		status,
		firstByteMs,
		totalMs,
		bytes,
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
	const firstByteValues = successful.map(result => result.firstByteMs).filter(value => Number.isFinite(value));
	const totalValues = successful.map(result => result.totalMs).filter(value => Number.isFinite(value));
	return {
		transport,
		runs: results.length,
		successful: successful.length,
		successRate: results.length ? successful.length / results.length : 0,
		firstByteP50Ms: firstByteValues.length ? Math.round(percentile(firstByteValues, 50)) : null,
		firstByteP95Ms: firstByteValues.length ? Math.round(percentile(firstByteValues, 95)) : null,
		totalP50Ms: totalValues.length ? Math.round(percentile(totalValues, 50)) : null,
		totalP95Ms: totalValues.length ? Math.round(percentile(totalValues, 95)) : null,
		bytesAvg: successful.length ? Math.round(successful.reduce((sum, result) => sum + result.bytes, 0) / successful.length) : 0,
	};
}

const args = parseArgs(process.argv.slice(2));
const url = args.url || process.env.TUNNEL_BENCH_URL || process.env.GRPC_BENCH_URL;
const uuid = args.uuid || process.env.TUNNEL_BENCH_UUID || process.env.GRPC_BENCH_UUID;
if (!url || !uuid) {
	usage();
	process.exit(2);
}

const options = {
	url,
	uuid,
	target: args.target || process.env.TUNNEL_BENCH_TARGET || process.env.GRPC_BENCH_TARGET || 'example.com',
	port: Number(args.port || process.env.TUNNEL_BENCH_PORT || process.env.GRPC_BENCH_PORT || 80),
	ua: args.ua || process.env.TUNNEL_BENCH_UA || process.env.GRPC_BENCH_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
	timeoutMs: Math.max(1000, Math.min(60000, Number(args.timeout || process.env.TUNNEL_BENCH_TIMEOUT || 15000))),
};
const runs = Math.max(1, Math.min(50, Number(args.runs || process.env.TUNNEL_BENCH_RUNS || process.env.GRPC_BENCH_RUNS || 5)));
const transports = normalizeTransports(args.transports || process.env.TUNNEL_BENCH_TRANSPORTS || 'grpc');
const runners = { grpc: runGrpc, ws: runWs, xhttp: runXhttp };
const allResults = [];

for (const transport of transports) {
	for (let i = 0; i < runs; i++) {
		try {
			const result = await runners[transport](options);
			allResults.push(result);
			console.log(JSON.stringify({ run: i + 1, ...result }));
		} catch (error) {
			const result = { transport, status: 0, firstByteMs: null, totalMs: null, bytes: 0, ok: false, error: error?.message || String(error) };
			allResults.push(result);
			console.log(JSON.stringify({ run: i + 1, ...result }));
		}
	}
}

console.log(JSON.stringify({
	summary: transports.map(transport => summarizeTransport(transport, allResults.filter(result => result.transport === transport))),
}, null, 2));

if (!allResults.some(result => result.ok)) process.exit(1);
