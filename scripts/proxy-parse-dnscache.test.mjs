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
		ex(src, 'stripIPv6Brackets') + ex(src, '获取SOCKS5账号') + 'return 获取SOCKS5账号;')();

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
	assert.throws(() => parse('u@host:1080', 443), /username:password/, `${file}: auth without a colon is refused`);

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
