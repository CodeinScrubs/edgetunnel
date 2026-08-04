import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A WebSocket message boundary and a gRPC protobuf field boundary are NOT protocol boundaries. WS and
// gRPC each assumed the first message/field carried a complete VLESS or Trojan header, so a legitimate
// client that split a valid header across two frames was rejected outright — a real compatibility bug,
// not an adversarial edge case.
//
// The parsers now live once, at module scope, behind a bounded accumulator with an absolute deadline.
// Testing a few chosen split points would repeat the mistake this project keeps making, so split every
// valid header at EVERY byte boundary.
const BUILDS = ['_worker_copypaste.js', 'wrangler_deploy_method_worker/_worker.js', 'src_static_ui/worker_test.js'];

function ex(t, n) {
	let i = t.indexOf('function ' + n + '('); assert.ok(i >= 0, `missing ${n}`);
	let p = i + 9 + n.length, par = 0;
	for (; p < t.length; p++) { if (t[p] === '(') par++; else if (t[p] === ')') { par--; if (par === 0) { p++; break; } } }
	const b = t.indexOf('{', p); let d = 0, seen = false, j = b;
	for (; j < t.length; j++) { const c = t[j]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { j++; break; } } }
	return t.slice(i, j);
}

const UUID = '8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04';
const uuidBytes = Uint8Array.from(UUID.replace(/-/g, '').match(/../g).map((h) => parseInt(h, 16)));

// version, uuid, optLen=0, cmd=1(TCP), port, atype=2(domain), len, host, then payload
function vlessHeader(host = 'example.com', port = 443, payload = [1, 2, 3]) {
	const h = new TextEncoder().encode(host);
	return Uint8Array.from([
		0, ...uuidBytes, 0, 1, (port >> 8) & 255, port & 255, 2, h.length, ...h, ...payload,
	]);
}

for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');
	const mod = new Function(
		'const VLESS文本解码器 = new TextDecoder(); const 预认证解码器 = VLESS文本解码器;' +
		'const 预认证最大字节 = 65536, 预认证超时毫秒 = 10000;' +
		'const UUID字节缓存 = new Map(); const SHA224_RESULT_CACHE = new Map(); const HASH_CACHE_MAX_ENTRIES = 256;' +
		ex(src, '数据转Uint8Array') + ex(src, '读取十六进制半字节') + ex(src, '获取UUID字节') + ex(src, 'UUID字节匹配') +
		ex(src, 'getLruCacheValue') + ex(src, 'setLruCacheValue') + ex(src, 'sha224未缓存') + ex(src, 'sha224') +
		ex(src, '解析魏烈思首包三态') + ex(src, '解析木马首包三态') + ex(src, '创建预认证累积器') +
		'return { 创建预认证累积器, 解析魏烈思首包三态 };')();

	const header = vlessHeader();

	// 1. Whole header in one push still works.
	{
		const acc = mod.创建预认证累积器(UUID);
		const r = acc.推入(header);
		assert.equal(r.状态, 'ok', `${file}: a complete header in one chunk must authenticate`);
		assert.equal(r.协议, 'vless');
		assert.equal(r.结果.hostname, 'example.com');
		assert.equal(r.结果.port, 443);
		assert.deepEqual([...r.结果.rawData], [1, 2, 3], `${file}: trailing application bytes must be preserved`);
	}

	// 2. THE regression: split at every byte boundary. Every split must reach the same result.
	// The header itself is 34 bytes (1 version + 16 uuid + 1 optLen + 1 cmd + 2 port + 1 atype + 1 len
	// + 11 host); cutting at or past that point legitimately completes on the FIRST fragment, so only an
	// earlier cut authenticating is a bug.
	const headerLen = header.length - 3;
	let firstFailure = null;
	for (let cut = 1; cut < header.length; cut++) {
		const acc = mod.创建预认证累积器(UUID);
		const a = acc.推入(header.subarray(0, cut));
		if (a.状态 === 'invalid') { firstFailure = `cut=${cut} rejected the first fragment (${a.原因})`; break; }
		if (a.状态 === 'ok') {
			if (cut < headerLen) { firstFailure = `cut=${cut} authenticated on a PARTIAL header`; break; }
			// Complete header arrived in fragment one; the payload it carried must match what was sent.
			if ([...a.结果.rawData].join() !== [...header.subarray(headerLen, cut)].join()) {
				firstFailure = `cut=${cut} mis-reported the trailing payload`; break;
			}
			continue;
		}
		const b = acc.推入(header.subarray(cut));
		if (b.状态 !== 'ok') { firstFailure = `cut=${cut} failed after the second fragment (${b.状态}${b.原因 ? ': ' + b.原因 : ''})`; break; }
		if (b.结果.hostname !== 'example.com' || b.结果.port !== 443) { firstFailure = `cut=${cut} parsed the wrong destination`; break; }
		if ([...b.结果.rawData].join() !== '1,2,3') { firstFailure = `cut=${cut} lost the trailing payload`; break; }
	}
	assert.equal(firstFailure, null, `${file}: ${firstFailure}`);

	// 3. Byte-at-a-time delivery — the worst case a real client can produce.
	{
		const acc = mod.创建预认证累积器(UUID);
		let final = null;
		for (let i = 0; i < header.length; i++) final = acc.推入(header.subarray(i, i + 1));
		assert.equal(final.状态, 'ok', `${file}: one-byte-at-a-time delivery must authenticate`);
		assert.equal(final.结果.hostname, 'example.com');
	}

	// 4. A wrong credential is rejected once BOTH protocols can be ruled out — and not before.
	{
		const bad = vlessHeader();
		bad[1] ^= 0xff;
		const acc = mod.创建预认证累积器(UUID);
		// Under 58 bytes this is genuinely ambiguous: a bad VLESS UUID could still be the opening bytes of
		// a valid Trojan header, whose 56-byte hash has not fully arrived. 'need_more' is the correct answer
		// and is exactly why classifying on the first fragment was wrong.
		assert.equal(acc.推入(bad.subarray(0, 40)).状态, 'need_more', `${file}: a short bad header is still ambiguous`);
		// Past the Trojan hash + CRLF length, neither protocol can match, so it must be refused.
		const 补齐 = new Uint8Array(64).fill(0x41);
		assert.equal(acc.推入(补齐).状态, 'invalid', `${file}: a wrong credential must be rejected once both protocols are ruled out`);
	}

	// 4b. A valid Trojan header must authenticate as trojan, not be mis-attributed to vless.
	{
		// Built from the real sha224 the parser uses, so the hash prefix matches byte for byte.
		const hash = new Function(
			'const SHA224_RESULT_CACHE = new Map(); const HASH_CACHE_MAX_ENTRIES = 256;' +
			ex(src, 'getLruCacheValue') + ex(src, 'setLruCacheValue') + ex(src, 'sha224未缓存') + ex(src, 'sha224') + 'return sha224;')()(UUID);
		const host = new TextEncoder().encode('example.com');
		const t = Uint8Array.from([
			...new TextEncoder().encode(hash), 0x0d, 0x0a,
			1, 3, host.length, ...host, 0x01, 0xbb, 0x0d, 0x0a, 9, 9,
		]);
		const acc = mod.创建预认证累积器(UUID);
		const r = acc.推入(t);
		assert.equal(r.状态, 'ok', `${file}: a valid Trojan header must authenticate`);
		assert.equal(r.协议, 'trojan', `${file}: it must be attributed to trojan`);
		assert.equal(r.结果.hostname, 'example.com');
		assert.equal(r.结果.port, 443);
		assert.deepEqual([...r.结果.rawData], [9, 9], `${file}: trojan trailing bytes preserved`);
	}

	// 5. Bounds: the byte cap is enforced and reported as invalid, not silently accepted.
	{
		const acc = mod.创建预认证累积器(UUID, 1024, 10000);
		const r = acc.推入(new Uint8Array(2048));
		assert.equal(r.状态, 'invalid', `${file}: exceeding the pre-auth byte cap must be refused`);
		assert.match(r.原因 || '', /too large/);
	}

	// 6. The deadline is ABSOLUTE: an expired accumulator refuses even a perfectly valid header.
	{
		const acc = mod.创建预认证累积器(UUID, 65536, -1);
		const r = acc.推入(header);
		assert.equal(r.状态, 'invalid', `${file}: an expired pre-auth window must refuse`);
		assert.match(r.原因 || '', /timed out/);
	}

	// 6b. WS EARLY DATA is a third ingress path. 解码WS早期数据 used to require a COMPLETE inner header
	// (>=18 bytes for 魏烈思, >=58 for 木马), so a header split across [early data][first message] had its
	// opening fragment silently discarded and the first real message began mid-header. Decoding must now
	// validate only encoding and size, and hand every byte to the accumulator.
	{
		const decode = new Function(
			'const WS早期数据最大字节 = 8192, WS早期数据最大头长度 = 10924;' +
			'const SHA224_RESULT_CACHE = new Map(); const HASH_CACHE_MAX_ENTRIES = 256;' +
			'const UUID字节缓存 = new Map();' +
			ex(src, 'getLruCacheValue') + ex(src, 'setLruCacheValue') + ex(src, 'sha224未缓存') + ex(src, 'sha224') +
			ex(src, '读取十六进制半字节') + ex(src, '获取UUID字节') + ex(src, 'UUID字节匹配') + ex(src, '是有效WS早期数据') +
			ex(src, '解码WS早期数据') + 'return 解码WS早期数据;')();

		// An ordinary Sec-WebSocket-Protocol token is NOT early data. Without `?ed` these must be ignored,
		// not decoded into tunnel bytes — accepting any decodable value made a normal client stall until the
		// pre-auth deadline (魏烈思) or be rejected (木马).
		for (const token of ['chat', 'mqtt', 'binary', 'graphql-ws', 'soap', 'wamp']) {
			assert.equal(decode(token, UUID, false), null,
				`${file}: ordinary subprotocol "${token}" must be ignored when ?ed is absent`);
		}
		// Strict base64url only: standard-base64 characters and padding are not early data.
		for (const bad of ['AA/', 'AA+', 'AA==', 'a b', '!!']) {
			assert.equal(decode(bad, UUID, false), null, `${file}: "${bad}" is not strict base64url`);
		}
		// Without `ed`, a COMPLETE header in early data still works (backward compatibility).
		{
			const b64 = Buffer.from(header).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
			const r = decode(b64, UUID, false);
			assert.ok(r && r.byteLength === header.length, `${file}: a complete early-data header must still be accepted without ?ed`);
		}
		const b64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		// Every prefix length, including ones far too short to be a recognisable header, must survive decoding.
		for (const cut of [1, 5, 10, 17, 18, 30, headerLen]) {
			const decoded = decode(b64url(header.subarray(0, cut)), UUID, true);
			assert.ok(decoded && decoded.byteLength === cut,
				`${file}: a ${cut}-byte early-data prefix must decode intact, not be discarded as "not a header"`);
		}
		// And the split must complete end-to-end through the accumulator.
		for (let cut = 1; cut < header.length; cut++) {
			const acc = mod.创建预认证累积器(UUID);
			const early = decode(b64url(header.subarray(0, cut)), UUID, true);
			assert.ok(early, `${file}: early-data cut=${cut} decoded to null`);
			const a = acc.推入(early);
			if (a.状态 === 'ok') continue;            // whole header fitted in early data
			assert.equal(a.状态, 'need_more', `${file}: early-data cut=${cut} was rejected (${a.原因})`);
			const b = acc.推入(header.subarray(cut));
			assert.equal(b.状态, 'ok', `${file}: early-data cut=${cut} failed once the first message arrived`);
			assert.equal(b.结果.hostname, 'example.com', `${file}: early-data cut=${cut} wrong destination`);
		}
		// Size and encoding are still enforced.
		assert.equal(decode('!!!not-base64!!!', UUID, true), null, `${file}: malformed base64url must be refused`);
		assert.throws(() => decode(b64url(new Uint8Array(9000)), UUID, true), /too large/, `${file}: oversized early data must throw`);
	}

	// 7. Both transports must actually USE the accumulator, not their own inline classifier.
	assert.match(src, /WS预认证 = 创建预认证累积器\(yourUUID\)/, `${file}: WS must use the shared accumulator`);
	assert.match(src, /gRPC预认证 = 创建预认证累积器\(yourUUID\)/, `${file}: gRPC must use the shared accumulator`);
	assert.match(src, /pre-authentication timed out after/, `${file}: WS must arm an absolute pre-auth deadline`);
}

// Shadowsocks has the same class of bug, and it survived the WS/gRPC round because SS carries its
// destination header in an AEAD-record byte stream: a record boundary is not a header boundary. Every
// decrypted record was assumed to start with a complete [ATYP][address][port], so a client that split one
// across two records was killed with "invalid ss ipv4 length". Drive the real parser at every split point.
{
	const { __testPerformanceHelpers: H } = await import('../_worker_copypaste.js');
	const enc = new TextEncoder();
	const host = enc.encode('example.com');
	const full = new Uint8Array(1 + 1 + host.length + 2 + 3);
	full[0] = 3;                                   // ATYP = domain
	full[1] = host.length;
	full.set(host, 2);
	full[2 + host.length] = 0x01;                  // port 443
	full[3 + host.length] = 0xbb;
	full.set([9, 8, 7], 4 + host.length);          // trailing payload

	for (let cut = 1; cut < full.length; cut++) {
		const partial = H.解析SS目标三态(full.subarray(0, cut));
		assert.notEqual(partial.状态, 'invalid',
			`a header split at byte ${cut} must be need_more, never invalid — that is the bug (${partial.原因 || ''})`);
	}
	const done = H.解析SS目标三态(full);
	assert.equal(done.状态, 'ok');
	assert.equal(done.hostname, 'example.com');
	assert.equal(done.port, 443);
	assert.deepEqual(Array.from(done.rawData), [9, 8, 7], 'payload after the header must survive intact');

	// Malformed input must still fail closed rather than accumulate forever.
	assert.equal(H.解析SS目标三态(new Uint8Array([9])).状态, 'invalid', 'an unknown address type is invalid, not need_more');
	assert.equal(H.解析SS目标三态(new Uint8Array([3, 0, 0, 0])).状态, 'invalid', 'a zero-length domain is invalid');
	assert.ok(H.SS首包最大字节 > 0 && H.SS首包最大字节 <= 64 * 1024, 'the accumulator must stay bounded');
}

for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');
	assert.match(src, /上下文\.首包缓存 = 上下文\.首包缓存\.byteLength \? 拼接字节数据/,
		`${file}: SS must accumulate its destination header across AEAD records`);
	assert.match(src, /SS destination header too large/, `${file}: the SS header accumulator must be bounded`);
	// A decrypt failure closed the socket with a normal 1000, i.e. "session finished fine".
	assert.match(src, /failClientTransportQuietly\(serverSock, err\);/,
		`${file}: an SS decrypt failure must fail the transport, not close it as a clean success`);
}


// A production capture showed one connection rejected with "Invalid inner header". Since every connection
// in that capture came from the operator's OWN client, the first question was whether the version guard --
// which was moved AHEAD of the length check -- could reject a legitimately fragmented header. It cannot,
// but "cannot" is worth proving rather than reasoning about, because a Trojan header's first byte is a hex
// character (0x33), i.e. NOT the zero the guard demands, so VLESS reports invalid on byte one. The
// accumulator only concludes invalid when BOTH parsers do, and Trojan still says need_more -- that
// interaction is the load-bearing part and it is not obvious from either parser alone.
{
	const { __testPerformanceHelpers: H } = await import('../_worker_copypaste.js');
	const UUID = '8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04';
	const hex = UUID.replace(/-/g, '');
	const uuidBytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) uuidBytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	const host = new TextEncoder().encode('example.com');

	const v = new Uint8Array(23 + host.length + 3);
	v[0] = 0; v.set(uuidBytes, 1); v[17] = 0; v[18] = 1; v[19] = 0x01; v[20] = 0xbb;
	v[21] = 2; v[22] = host.length; v.set(host, 23); v.set([9, 8, 7], 23 + host.length);
	for (let cut = 1; cut < v.length; cut++) {
		const acc = H.创建预认证累积器(UUID);
		const first = acc.推入(v.subarray(0, cut));
		assert.notEqual(first.状态, 'invalid', `a 魏烈思 header split at byte ${cut} must accumulate, not be rejected`);
		assert.equal(acc.推入(v.subarray(cut)).状态, 'ok', `a 魏烈思 header split at byte ${cut} must complete`);
	}

	const pw = new TextEncoder().encode(H.sha224(UUID));
	const t = new Uint8Array(65 + host.length + 3);
	t.set(pw.subarray(0, 56), 0); t[56] = 0x0d; t[57] = 0x0a;
	t[58] = 1; t[59] = 3; t[60] = host.length; t.set(host, 61);
	t[61 + host.length] = 0x01; t[62 + host.length] = 0xbb; t[63 + host.length] = 0x0d; t[64 + host.length] = 0x0a;
	assert.notEqual(t[0], 0, 'this test is only meaningful while a 木马 header does not start with 0');
	for (let cut = 1; cut < t.length; cut++) {
		const acc = H.创建预认证累积器(UUID);
		assert.notEqual(acc.推入(t.subarray(0, cut)).状态, 'invalid',
			`a 木马 header split at byte ${cut} must accumulate: 魏烈思 calls byte one invalid, so only 木马 saying need_more keeps it alive`);
	}

	// Genuinely non-tunnel data must still be rejected once both parsers can decide.
	const junk = new Uint8Array(64).fill(0x41);
	assert.equal(H.创建预认证累积器(UUID).推入(junk).状态, 'invalid', 'data that is neither protocol must be rejected');
}

console.log('pre-auth fragmentation tests passed');
