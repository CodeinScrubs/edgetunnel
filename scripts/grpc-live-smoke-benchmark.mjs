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
		'  node scripts/grpc-live-smoke-benchmark.mjs --url https://your-domain.example/ --uuid 00000000-0000-4000-8000-000000000000',
		'',
		'Options:',
		'  --runs 5                 Number of requests to run',
		'  --target example.com     Plain HTTP target reached through the tunnel',
		'  --port 80                Target port',
		'  --ua "Mozilla/5.0 ..."   gRPC User-Agent',
	].join('\n'));
}

function uuidBytes(uuid) {
	const hex = String(uuid || '').replace(/-/g, '');
	if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error('UUID must be a valid UUID string');
	return new Uint8Array(hex.match(/../g).map(value => parseInt(value, 16)));
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

async function runOnce({ url, uuid, target, port, ua }) {
	const httpRequest = new TextEncoder().encode(`GET / HTTP/1.1\r\nHost: ${target}\r\nUser-Agent: ${ua}\r\nConnection: close\r\n\r\n`);
	const firstPacket = makeVlessTcpRequest(uuid, target, port, httpRequest);
	const body = encodeGrpcFrame([firstPacket]);
	const startedAt = performance.now();
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/grpc',
			'User-Agent': ua,
		},
		body,
	});
	const reader = response.body.getReader();
	const chunks = [];
	let firstByteMs = null;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value && value.byteLength) {
			if (firstByteMs === null) firstByteMs = performance.now() - startedAt;
			chunks.push(new Uint8Array(value));
		}
	}
	const totalMs = performance.now() - startedAt;
	const bytes = concatBytes(chunks);
	const payloads = decodeGrpcPayloads(bytes);
	const tunneled = concatBytes(payloads.slice(1));
	const text = new TextDecoder().decode(tunneled.subarray(0, 128));
	return {
		status: response.status,
		firstByteMs,
		totalMs,
		bytes: bytes.byteLength,
		ok: response.ok && /HTTP\/1\.[01]\s+\d+/.test(text),
	};
}

const args = parseArgs(process.argv.slice(2));
const url = args.url || process.env.GRPC_BENCH_URL;
const uuid = args.uuid || process.env.GRPC_BENCH_UUID;
if (!url || !uuid) {
	usage();
	process.exit(2);
}

const options = {
	url,
	uuid,
	target: args.target || process.env.GRPC_BENCH_TARGET || 'example.com',
	port: Number(args.port || process.env.GRPC_BENCH_PORT || 80),
	ua: args.ua || process.env.GRPC_BENCH_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
};
const runs = Math.max(1, Math.min(50, Number(args.runs || process.env.GRPC_BENCH_RUNS || 5)));
const results = [];
for (let i = 0; i < runs; i++) {
	const result = await runOnce(options);
	results.push(result);
	console.log(JSON.stringify({ run: i + 1, ...result }));
}
const successful = results.filter(result => result.ok);
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
if (successful.length) {
	console.log(JSON.stringify({
		summary: {
			runs,
			successful: successful.length,
			firstByteAvgMs: Math.round(average(successful.map(result => result.firstByteMs))),
			totalAvgMs: Math.round(average(successful.map(result => result.totalMs))),
			bytesAvg: Math.round(average(successful.map(result => result.bytes))),
		},
	}, null, 2));
} else {
	console.error('No successful tunneled HTTP responses were observed.');
	process.exit(1);
}
