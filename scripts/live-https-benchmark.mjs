import { performance } from 'node:perf_hooks';
import { Duplex } from 'node:stream';
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
		'  node scripts/live-https-benchmark.mjs --url https://your-worker.example/ --uuid your-vless-uuid --front-host sourceforge.net --sni your-worker.example --authority your-worker.example --target example.com',
		'',
		'Options:',
		'  --runs 5                 Number of HTTPS requests',
		'  --target example.com     Inner HTTPS target host reached through the tunnel',
		'  --port 443               Inner HTTPS target port',
		'  --path /                 Inner HTTPS path',
		'  --front-host example.com Outer gRPC clean/front host',
		'  --sni worker.example     Outer TLS SNI/servername override',
		'  --authority worker.example Outer HTTP/2 :authority override',
		'  --service-name /         Outer gRPC request path/serviceName override',
		'  --timeout 20000          Per-run timeout in milliseconds',
		'  --allow-insecure 1       Disable inner HTTPS certificate validation',
		'  --summary-line           Emit compact JSON summary for wrapper scripts',
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
			payloads.push(bytes.subarray(nextOffset, payloadEnd));
			messageOffset = payloadEnd;
		}
		offset = frameEnd;
	}
	return { payloads, pending: bytes.subarray(offset) };
}

function makeVlessTcpRequest(uuid, hostname, port, rawData) {
	const hostBytes = new TextEncoder().encode(hostname);
	if (hostBytes.byteLength > 255) throw new Error('Target hostname is too long for VLESS domain address');
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

function normalizePort(value) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`Invalid port: ${value}`);
	return parsed;
}

class GrpcTunnelSocket extends Duplex {
	constructor(req, options) {
		super();
		this.req = req;
		this.options = options;
		this.pending = new Uint8Array(0);
		this.firstWrite = true;
		this.accepted = false;
	}

	_read() {}

	_write(chunk, _encoding, callback) {
		try {
			const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
			const payload = this.firstWrite
				? makeVlessTcpRequest(this.options.uuid, this.options.target, this.options.port, bytes)
				: bytes;
			this.firstWrite = false;
			this.req.write(Buffer.from(encodeGrpcFrame([payload])));
			callback();
		} catch (error) {
			callback(error);
		}
	}

	_final(callback) {
		try { this.req.end(); } catch {}
		callback();
	}

	_destroy(error, callback) {
		try { this.req.close?.(); } catch {}
		callback(error);
	}

	setTimeout() { return this; }
	setNoDelay() { return this; }
	setKeepAlive() { return this; }
	ref() { return this; }
	unref() { return this; }
	destroySoon() { this.destroy(); }

	acceptGrpcChunk(chunk) {
		const merged = concatBytes([this.pending, chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)]);
		const parsed = decodeGrpcPayloads(merged);
		this.pending = parsed.pending;
		for (let payload of parsed.payloads) {
			if (!this.accepted) {
				if (payload.byteLength >= 2 && payload[0] === 0 && payload[1] === 0) {
					this.accepted = true;
					payload = payload.subarray(2);
				} else {
					this.destroy(new Error('Tunnel did not return a VLESS response header'));
					return;
				}
			}
			if (payload.byteLength) this.push(Buffer.from(payload));
		}
	}
}

function openGrpcTunnel(options) {
	const outerUrl = new URL(options.url);
	const authority = options.authority || outerUrl.host;
	const serviceName = options.serviceName || `${outerUrl.pathname || '/'}${outerUrl.search || ''}` || '/';
	const front = parseHostPort(options.frontHost, Number(outerUrl.port || 443));
	const connectHost = front?.hostname || outerUrl.hostname;
	const connectPort = front?.port || Number(outerUrl.port || 443);
	const servername = options.sni || outerUrl.hostname;
	const origin = `https://${authority}`;

	const client = http2.connect(origin, {
		createConnection: () => tls.connect({
			host: connectHost,
			port: connectPort,
			servername,
			ALPNProtocols: ['h2'],
		}),
	});
	const req = client.request({
		':method': 'POST',
		':scheme': 'https',
		':authority': authority,
		':path': serviceName,
		'content-type': 'application/grpc',
		'user-agent': options.ua,
		te: 'trailers',
	});
	const tunnelSocket = new GrpcTunnelSocket(req, options);
	const closeAll = error => {
		if (error) tunnelSocket.destroy(error);
		else tunnelSocket.push(null);
		try { client.close(); } catch {}
	};
	client.on('error', closeAll);
	req.on('error', closeAll);
	req.on('data', chunk => tunnelSocket.acceptGrpcChunk(new Uint8Array(chunk)));
	req.on('end', () => closeAll());
	tunnelSocket.on('close', () => {
		try { req.close?.(); } catch {}
		try { client.close(); } catch {}
	});
	return tunnelSocket;
}

async function runHttpsGrpc(options) {
	const startedAt = performance.now();
	const tunnelSocket = openGrpcTunnel(options);
	let tlsMs = null;
	let firstByteMs = null;
	const chunks = [];
	const tlsSocket = tls.connect({
		socket: tunnelSocket,
		servername: options.target,
		rejectUnauthorized: !options.allowInsecure,
		ALPNProtocols: ['http/1.1'],
	});

	return await new Promise((resolve, reject) => {
		let settled = false;
		const finish = (fn, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try { tlsSocket.destroy(); } catch {}
			try { tunnelSocket.destroy(); } catch {}
			fn(value);
		};
		const timer = setTimeout(() => finish(reject, new Error('HTTPS tunnel benchmark timed out')), options.timeoutMs);
		tlsSocket.on('secureConnect', () => {
			tlsMs = performance.now() - startedAt;
			tlsSocket.write(`GET ${options.path} HTTP/1.1\r\nHost: ${options.target}\r\nUser-Agent: ${options.ua}\r\nAccept: */*\r\nConnection: close\r\n\r\n`);
		});
		tlsSocket.on('data', chunk => {
			if (chunk.byteLength) {
				if (firstByteMs === null) firstByteMs = performance.now() - startedAt;
				chunks.push(new Uint8Array(chunk));
			}
		});
		tlsSocket.on('end', () => {
			const bytes = concatBytes(chunks);
			const text = new TextDecoder().decode(bytes.subarray(0, 160));
			const inner = parseInnerHttpStatus(text);
			const totalMs = performance.now() - startedAt;
			finish(resolve, {
				transport: 'grpc',
				target: `${options.target}:${options.port}${options.path}`,
				tlsMs,
				firstByteMs,
				totalMs,
				bytes: bytes.byteLength,
				tunnelAccepted: tunnelSocket.accepted,
				innerStatus: inner.status,
				innerStatusText: inner.statusText,
				ok: Boolean(tunnelSocket.accepted && isInnerHttpOk(inner.status)),
			});
		});
		tlsSocket.on('error', error => finish(reject, error));
	});
}

function parseInnerHttpStatus(text) {
	const match = /^HTTP\/1\.[01]\s+(\d{3})(?:\s+([^\r\n]*))?/m.exec(text || '');
	if (!match) return { status: null, statusText: '' };
	return { status: Number(match[1]), statusText: match[2] || '' };
}

function isInnerHttpOk(status) {
	return Number.isFinite(status) && status >= 200 && status < 500;
}

function percentile(values, p) {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[index];
}

function roundedSpread(values) {
	if (values.length < 2) return null;
	const p50 = percentile(values, 50);
	const p95 = percentile(values, 95);
	return Number.isFinite(p50) && Number.isFinite(p95) ? Math.max(0, Math.round(p95 - p50)) : null;
}

function summarize(results) {
	const successful = results.filter(result => result.ok);
	const accepted = results.filter(result => result.tunnelAccepted);
	const tlsValues = successful.map(result => result.tlsMs).filter(Number.isFinite);
	const firstByteValues = successful.map(result => result.firstByteMs).filter(Number.isFinite);
	const totalValues = successful.map(result => result.totalMs).filter(Number.isFinite);
	return {
		transport: 'grpc',
		runs: results.length,
		accepted: accepted.length,
		acceptRate: results.length ? accepted.length / results.length : 0,
		successful: successful.length,
		successRate: results.length ? successful.length / results.length : 0,
		tlsP50Ms: tlsValues.length ? Math.round(percentile(tlsValues, 50)) : null,
		tlsP95Ms: tlsValues.length ? Math.round(percentile(tlsValues, 95)) : null,
		tlsJitterMs: roundedSpread(tlsValues),
		firstByteP50Ms: firstByteValues.length ? Math.round(percentile(firstByteValues, 50)) : null,
		firstByteP95Ms: firstByteValues.length ? Math.round(percentile(firstByteValues, 95)) : null,
		firstByteJitterMs: roundedSpread(firstByteValues),
		totalP50Ms: totalValues.length ? Math.round(percentile(totalValues, 50)) : null,
		totalP95Ms: totalValues.length ? Math.round(percentile(totalValues, 95)) : null,
		totalJitterMs: roundedSpread(totalValues),
		bytesAvg: successful.length ? Math.round(successful.reduce((sum, result) => sum + result.bytes, 0) / successful.length) : 0,
	};
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

const options = {
	url,
	uuid,
	target: args.target || process.env.TUNNEL_BENCH_TARGET || 'example.com',
	port: normalizePort(args.port || process.env.TUNNEL_BENCH_PORT || 443),
	path: String(args.path || args['http-path'] || process.env.TUNNEL_BENCH_HTTP_PATH || '/'),
	ua: args.ua || process.env.TUNNEL_BENCH_UA || process.env.GRPC_BENCH_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
	timeoutMs: Math.max(1000, Math.min(60000, Number(args.timeout || process.env.TUNNEL_BENCH_TIMEOUT || 20000))),
	frontHost: args['front-host'] || args.front || process.env.TUNNEL_BENCH_FRONT_HOST || process.env.GRPC_BENCH_FRONT_HOST || '',
	sni: args.sni || process.env.TUNNEL_BENCH_SNI || process.env.GRPC_BENCH_SNI || '',
	authority: args.authority || process.env.TUNNEL_BENCH_AUTHORITY || process.env.GRPC_BENCH_AUTHORITY || '',
	serviceName: args['service-name'] || args.serviceName || process.env.TUNNEL_BENCH_SERVICE_NAME || process.env.GRPC_BENCH_SERVICE_NAME || '',
	allowInsecure: ['1', 'true'].includes(String(args['allow-insecure'] || process.env.TUNNEL_BENCH_ALLOW_INSECURE || '').toLowerCase()),
};
if (!options.path.startsWith('/')) throw new Error('HTTPS path must start with /');
const runs = Math.max(1, Math.min(50, Number(args.runs || process.env.TUNNEL_BENCH_RUNS || 5)));
const results = [];

for (let i = 0; i < runs; i++) {
	try {
		const result = await runHttpsGrpc(options);
		results.push(result);
		console.log(JSON.stringify({ run: i + 1, profile: 'https', ...result }));
	} catch (error) {
		const result = { transport: 'grpc', target: `${options.target}:${options.port}${options.path}`, tlsMs: null, firstByteMs: null, totalMs: null, bytes: 0, tunnelAccepted: false, ok: false, error: error?.message || String(error) };
		results.push(result);
		console.log(JSON.stringify({ run: i + 1, profile: 'https', ...result }));
	}
}

const summaryPayload = {
	profile: 'https',
	target: `${options.target}:${options.port}${options.path}`,
	summary: [summarize(results)],
};
console.log(JSON.stringify(summaryPayload, null, 2));
if (args['summary-line']) console.log(JSON.stringify({ type: 'summary', ...summaryPayload }));

if (!results.some(result => result.ok)) process.exit(1);
