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
		ex(src, 'getLruCacheValue') + ex(src, 'setLruCacheValue') + ex(src, 'sha224') +
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
			ex(src, 'getLruCacheValue') + ex(src, 'setLruCacheValue') + ex(src, 'sha224') + 'return sha224;')()(UUID);
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
			ex(src, '解码WS早期数据') + 'return 解码WS早期数据;')();
		const b64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		// Every prefix length, including ones far too short to be a recognisable header, must survive decoding.
		for (const cut of [1, 5, 10, 17, 18, 30, headerLen]) {
			const decoded = decode(b64url(header.subarray(0, cut)), UUID);
			assert.ok(decoded && decoded.byteLength === cut,
				`${file}: a ${cut}-byte early-data prefix must decode intact, not be discarded as "not a header"`);
		}
		// And the split must complete end-to-end through the accumulator.
		for (let cut = 1; cut < header.length; cut++) {
			const acc = mod.创建预认证累积器(UUID);
			const early = decode(b64url(header.subarray(0, cut)), UUID);
			assert.ok(early, `${file}: early-data cut=${cut} decoded to null`);
			const a = acc.推入(early);
			if (a.状态 === 'ok') continue;            // whole header fitted in early data
			assert.equal(a.状态, 'need_more', `${file}: early-data cut=${cut} was rejected (${a.原因})`);
			const b = acc.推入(header.subarray(cut));
			assert.equal(b.状态, 'ok', `${file}: early-data cut=${cut} failed once the first message arrived`);
			assert.equal(b.结果.hostname, 'example.com', `${file}: early-data cut=${cut} wrong destination`);
		}
		// Size and encoding are still enforced.
		assert.equal(decode('!!!not-base64!!!', UUID), null, `${file}: malformed base64url must be refused`);
		assert.throws(() => decode(b64url(new Uint8Array(9000)), UUID), /too large/, `${file}: oversized early data must throw`);
	}

	// 7. Both transports must actually USE the accumulator, not their own inline classifier.
	assert.match(src, /WS预认证 = 创建预认证累积器\(yourUUID\)/, `${file}: WS must use the shared accumulator`);
	assert.match(src, /gRPC预认证 = 创建预认证累积器\(yourUUID\)/, `${file}: gRPC must use the shared accumulator`);
	assert.match(src, /pre-authentication timed out after/, `${file}: WS must arm an absolute pre-auth deadline`);
}

console.log('pre-auth fragmentation tests passed');
