import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Two defects an external review reproduced, plus the parsed-DNS-cache memory bound.
const BUILDS = ['_worker_copypaste.js', 'wrangler_deploy_method_worker/_worker.js', 'src_static_ui/worker_test.js'];

function ex(t, n) {
	let i = t.indexOf('async function ' + n + '('); let kw = 'async function ';
	if (i < 0) { i = t.indexOf('function ' + n + '('); kw = 'function '; }
	assert.ok(i >= 0, `missing ${n}`);
	let p = i + kw.length + n.length, par = 0;
	for (; p < t.length; p++) { if (t[p] === '(') par++; else if (t[p] === ')') { par--; if (par === 0) { p++; break; } } }
	const b = t.indexOf('{', p); let d = 0, seen = false, j = b;
	for (; j < t.length; j++) { const c = t[j]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { j++; break; } } }
	return t.slice(i, j);
}

for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');

	// ---- proxy credential / port parsing ----
	const parse = new Function(
		// Use the REAL constants from the build; a looser stub sent single-character auth down the
		// base64 branch and made the test fail on its own fixture rather than on the code.
		src.match(/const SOCKS5账号Base64正则 = [^\n]+/)[0] +
		// 获取SOCKS5账号 validates a bracketed authority through IPv6转字节, which is a hoisted top-level
		// function in the real build, so the harness must provide it too.
		ex(src, 'stripIPv6Brackets') + ex(src, 'IPv6转字节') + ex(src, '获取SOCKS5账号') + 'return 获取SOCKS5账号;')();

	// A password may contain colons; only the FIRST colon separates it from the username.
	const withColons = parse('user:pa:ss:word@host:1080', 443);
	assert.equal(withColons.username, 'user', `${file}: username`);
	assert.equal(withColons.password, 'pa:ss:word', `${file}: a colon-bearing password must survive intact`);
	assert.equal(withColons.hostname, 'host');
	assert.equal(withColons.port, 1080);

	// A malformed port must be REFUSED, never silently coerced to a different port.
	assert.throws(() => parse('u:p@host:80abc', 443), /port must be a number/,
		`${file}: "80abc" must be rejected, not stripped to 80`);
	assert.throws(() => parse('u:p@host:0', 443), /out of range/, `${file}: port 0 must be rejected`);
	assert.throws(() => parse('u:p@host:70000', 443), /out of range/, `${file}: port 70000 must be rejected`);

	// Ordinary forms still work.
	assert.equal(parse('u:p@host:1080', 443).port, 1080, `${file}: normal port`);
	assert.equal(parse('host', 443).port, 443, `${file}: default port applies`);
	assert.equal(parse('[2001:db8::1]:8443', 443).hostname, '[2001:db8::1]', `${file}: IPv6 host`);
	assert.equal(parse('[2001:db8::1]:8443', 443).port, 8443, `${file}: IPv6 port`);
	assert.equal(parse('[2001:db8::1]', 443).port, 443, `${file}: bracketed host without a port takes the default`);
	// A bracketed authority is matched as a whole: contents must be a real address and nothing may trail it.
	for (const bad of ['[notipv6]:80', '[1:2:3]:80', '[2001:db8::1]:80]:90', '[2001:db8::1]:80x', '[]:80']) {
		assert.throws(() => parse(bad, 443), /Invalid proxy address format/, `${file}: "${bad}" must be rejected`);
	}
	assert.throws(() => parse('u@host:1080', 443), /username:password/, `${file}: auth without a colon is refused`);

	// ---- parser strictness ----
	// Percent-encoded userinfo is the only way to carry ':' or '@' in a credential (RFC 3986).
	const enc = parse('u%3Aname:p%3Aq@host:80', 443);
	assert.equal(enc.username, 'u:name', `${file}: percent-decoded username`);
	assert.equal(enc.password, 'p:q', `${file}: percent-decoded password`);
	// A malformed escape must NOT throw -- an existing password with a bare '%' has to keep working.
	assert.equal(parse('u:100%pure@host:80', 443).password, '100%pure', `${file}: bare % survives`);
	// An empty host was accepted and then dialled as "".
	// "[]" is rejected by the stricter bracketed-authority matcher below, with its own message.
	for (const bad of ['u:p@:80', ':p@host:80']) {
		assert.throws(() => parse(bad, 443), /must not be empty/, `${file}: "${bad}" must be rejected`);
	}

	// ---- SOCKS5 / CONNECT wire format (RFC 1928 / RFC 7230) ----
	const wire = new Function(
		ex(src, 'stripIPv6Brackets') + ex(src, 'isIPv4') + ex(src, 'isIPHostname') +
		ex(src, 'IPv6转字节') + ex(src, '格式化主机端口') +
		'return { IPv6转字节, 格式化主机端口, isIPv4 };')();

	// IPv6 -> 16 octets, including :: compression and the IPv4-mapped tail.
	const full = wire.IPv6转字节('2001:0db8:0000:0000:0000:0000:0000:0001');
	const compressed = wire.IPv6转字节('2001:db8::1');
	assert.deepEqual([...compressed], [...full], `${file}: :: compression must expand identically`);
	assert.equal(compressed.byteLength, 16, `${file}: IPv6 must encode to 16 octets`);
	assert.deepEqual([...wire.IPv6转字节('::1')].slice(-1), [1], `${file}: ::1 loopback`);
	const mapped = wire.IPv6转字节('::ffff:1.2.3.4');
	assert.deepEqual([...mapped].slice(-6), [0xff, 0xff, 1, 2, 3, 4], `${file}: IPv4-mapped tail`);
	// `::` must stand for AT LEAST ONE omitted zero group (RFC 4291). Eight explicit hextets plus a
	// compression marker is malformed, and an overfull address must return null rather than throwing
	// RangeError from a negative fill length.
	for (const bad of ['not-an-ip', '2001:db8::1::2', '', '1.2.3.4', 'gggg::1',
		'1:2:3:4:5:6:7::8', '1:2:3:4:5:6:7:8::', '::1:2:3:4:5:6:7:8', '1:2:3:4:5:6:7:8:9']) {
		let got;
		assert.doesNotThrow(() => { got = wire.IPv6转字节(bad); }, `${file}: "${bad}" must return null, not throw`);
		assert.equal(got, null, `${file}: "${bad}" must not parse as IPv6`);
	}
	// The overfull-with-compression case previously threw RangeError; it must now be null.
	let overfull;
	assert.doesNotThrow(() => { overfull = wire.IPv6转字节('1:2:3:4:5:6:7:8::9'); }, `${file}: overfull IPv6 must not throw`);
	assert.equal(overfull, null, `${file}: overfull IPv6 must return null`);
	// `::` alone is the unspecified address and IS valid (eight omitted groups).
	assert.deepEqual([...wire.IPv6转字节('::')], new Array(16).fill(0), `${file}: :: is all-zero, still valid`);

	// CONNECT authority must bracket IPv6 and leave everything else alone.
	assert.equal(wire.格式化主机端口('2001:db8::1', 443), '[2001:db8::1]:443', `${file}: IPv6 authority must be bracketed`);
	assert.equal(wire.格式化主机端口('[2001:db8::1]', 443), '[2001:db8::1]:443', `${file}: already-bracketed stays single-bracketed`);
	assert.equal(wire.格式化主机端口('1.2.3.4', 443), '1.2.3.4:443', `${file}: IPv4 authority unchanged`);
	assert.equal(wire.格式化主机端口('example.com', 8443), 'example.com:8443', `${file}: domain authority unchanged`);

	// The SOCKS5 CONNECT packet must select ATYP by address family, not always 0x03.
	const s5 = ex(src, 'socks5Connect');
	assert.match(s5, /0x05, 0x01, 0x00, 0x01, \.\.\.八位组/, `${file}: SOCKS5 must send ATYP 0x01 for a literal IPv4`);
	assert.match(s5, /0x05, 0x01, 0x00, 0x04, \.\.\.字节/, `${file}: SOCKS5 must send ATYP 0x04 for a literal IPv6`);
	assert.match(s5, /0x05, 0x01, 0x00, 0x03, hostBytes\.length/, `${file}: SOCKS5 must still send ATYP 0x03 for a domain`);

	// ---- endpoint parser must agree with IPv6转字节, not its own regex ----
	const endpoint = new Function(
		'const IPv6方括号正则 = /^\\[.*\\]$/;' +
		ex(src, 'stripIPv6Brackets') + ex(src, 'IPv6转字节') + ex(src, 'parsePreferredEndpointText') +
		'return parsePreferredEndpointText;')();
	// Valid IPv4-mapped form was refused for containing dots.
	assert.ok(endpoint('[::ffff:1.2.3.4]:443'), `${file}: [::ffff:1.2.3.4] is valid and must be accepted`);
	// Shape-only matches that are not addresses were accepted.
	for (const bad of ['[:::]:443', '[1:2:3]:443', '[notipv6]:443', '[]:443']) {
		assert.equal(endpoint(bad), null, `${file}: "${bad}" must be rejected`);
	}
	for (const good of ['[2001:db8::1]:443', '1.2.3.4:443', 'example.com:443', 'example.com']) {
		assert.ok(endpoint(good), `${file}: "${good}" must still parse`);
	}

	// ---- proxy cache key must not collide ----
	// proxyCacheKey digests its tuple, so the harness needs sha224 and its LRU memo.
	const ck = new Function(
		'const PROXY_RESOLUTION_CACHE_VERSION = 3;' +
		'const SHA224_RESULT_CACHE = new Map(); const HASH_CACHE_MAX_ENTRIES = 256;' +
		ex(src, 'getLruCacheValue') + ex(src, 'setLruCacheValue') + ex(src, 'sha224') +
		ex(src, 'proxyCacheKey') + 'return proxyCacheKey;')();
	// Fixed-length and credential-free: Workers KV caps a key at 512 bytes, and a plaintext key also put
	// the UUID into KV key NAMES where listings expose it.
	const 巨型 = ck('p'.repeat(500), 'h'.repeat(500) + '.example.com', '8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04');
	assert.ok(new TextEncoder().encode(巨型).byteLength <= 512, `${file}: cache key must fit KV's 512-byte limit, got ${new TextEncoder().encode(巨型).byteLength}`);
	assert.ok(!巨型.includes('8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04'), `${file}: the UUID must not appear in the cache key`);
	// This exact pair collides under the old 32-bit stableHashText (both -> 4a10ac9e), which meant two
	// unrelated destinations shared one proxy-resolution entry.
	assert.notEqual(ck('p', 'me4ass0cl38u.com', 'u'), ck('p', 'twm7ryzpvqkh.com', 'u'),
		`${file}: known-colliding hosts must produce different cache keys`);
	// Separators must not be forgeable by a value containing one.
	assert.notEqual(ck('a:b', 'c', ''), ck('a', 'b:c', ''), `${file}: length prefixes must make the key unambiguous`);
	assert.notEqual(ck('a', '', ''), ck('', 'a', ''), `${file}: field position must matter`);
	assert.equal(ck('P', 'H', 'U'), ck('p', 'h', 'u'), `${file}: case is normalised`);

	// ---- the camouflage origin must never receive a request body ----
	assert.match(src, /request\.method !== 'GET' && request\.method !== 'HEAD'/,
		`${file}: only GET/HEAD may reach the decoy origin; a wrong-path POST would forward raw tunnel bytes`);

	// ---- persistent KV proxy cache must be opt-in on a free-plan build ----
	const kv = new Function(ex(src, 'isEnabledEnvFlag') + ex(src, 'isProxyResolutionKvCacheEnabled') + 'return isProxyResolutionKvCacheEnabled;')();
	assert.equal(kv({}), false, `${file}: KV proxy cache must default OFF`);
	assert.equal(kv({ ENABLE_KV_PROXY_CACHE: '' }), false, `${file}: an empty value is not opt-in`);
	assert.equal(kv({ ENABLE_KV_PROXY_CACHE: '1' }), true, `${file}: explicit 1 enables it`);
	assert.equal(kv({ ENABLE_KV_PROXY_CACHE: '1', OFF_PROXY_CACHE: '1' }), false, `${file}: the off switch still wins`);

	// ---- parsed DNS cache must be byte-bounded, not entry-bounded only ----
	assert.match(src, /const DNS_RESULT_CACHE_MAX_BYTES = /, `${file}: DNS_RESULT_CACHE needs a byte ceiling`);
	assert.match(src, /const DNS_RESULT_CACHE_MAX_ENTRY_BYTES = /, `${file}: DNS_RESULT_CACHE needs a per-entry ceiling`);
	assert.doesNotMatch(src, /setLruCacheValue\(DNS_RESULT_CACHE/, `${file}: writes must route through the byte-accounted helper`);

	const cache = new Function(
		'const DNS_RESULT_CACHE = new Map();' +
		'const DNS_RESULT_CACHE_MAX_ENTRIES = 256;' +
		src.match(/const DNS_RESULT_CACHE_MAX_BYTES = [^\n]+/)[0] +
		src.match(/const DNS_RESULT_CACHE_MAX_ENTRY_BYTES = [^\n]+/)[0] +
		'let DNS_RESULT_CACHE字节 = 0;' +
		ex(src, '估算应答字节') + ex(src, '估算条目字节') + ex(src, 'DNS结果缓存写入') + ex(src, 'DNS结果缓存删除') +
		'return { 写: DNS结果缓存写入, 删: DNS结果缓存删除, 表: DNS_RESULT_CACHE, 字节: () => DNS_RESULT_CACHE字节 };')();

	const mk = (bytes) => ({ expiresAt: Date.now() + 60000, answers: [{ name: 'a.example', rdata: new Uint8Array(bytes) }] });

	// 256 large entries must NOT retain ~15 MiB.
	for (let i = 0; i < 256; i++) cache.写('k' + i, mk(60 * 1024));
	assert.equal(cache.表.size, 0, `${file}: entries above the per-entry cap must be refused, got ${cache.表.size}`);
	assert.equal(cache.字节(), 0, `${file}: byte counter must stay 0 when nothing was admitted`);

	// Entries under the per-entry cap are admitted, and the TOTAL stays bounded.
	for (let i = 0; i < 400; i++) cache.写('m' + i, mk(8 * 1024));
	assert.ok(cache.字节() <= 2 * 1024 * 1024, `${file}: total bytes must stay under the cap, got ${cache.字节()}`);
	assert.ok(cache.表.size < 400, `${file}: eviction must have run`);

	// Replacement and deletion must both adjust the counter (drift wedges or disables eviction).
	const before = cache.字节();
	const key = [...cache.表.keys()][0];
	cache.写(key, mk(1024));
    assert.ok(cache.字节() < before, `${file}: replacing a larger entry must lower the byte total`);
	cache.删(key);
	assert.ok(!cache.表.has(key), `${file}: delete must remove the entry`);

	// Draining everything must return the counter to exactly 0 — proof there is no drift.
	for (const k of [...cache.表.keys()]) cache.删(k);
	assert.equal(cache.表.size, 0, `${file}: cache should be empty`);
	assert.equal(cache.字节(), 0, `${file}: byte counter must return to 0, got ${cache.字节()} (drift)`);
}

console.log('proxy-parse + dns-cache tests passed');
