import assert from 'node:assert/strict';
import { isIPv6 } from 'node:net';
import { readFileSync } from 'node:fs';

// IPv6转字节 has now been fixed twice against hand-picked lists, and both times the underlying flaw
// survived: the first patch let `::` stand for zero groups, the second still filtered empty components
// so ':1:2:3:4:5:6:7:8' and '1:2:3:4:5:6:7:8:' were silently encoded as the well-formed address. A
// malformed configured address therefore became a DIFFERENT valid one and got dialled.
//
// Testing against another list of remembered failures would repeat the mistake. Instead, compare the
// parser against Node's own `net.isIPv6` across a generated corpus: for every input, "did we produce
// bytes" must equal "is this a valid IPv6 literal". That is an oracle nobody hand-picked.
const BUILDS = ['_worker_copypaste.js', 'wrangler_deploy_method_worker/_worker.js', 'src_static_ui/worker_test.js'];

function ex(t, n) {
	let i = t.indexOf('function ' + n + '('); assert.ok(i >= 0, `missing ${n}`);
	let p = i + 9 + n.length, par = 0;
	for (; p < t.length; p++) { if (t[p] === '(') par++; else if (t[p] === ')') { par--; if (par === 0) { p++; break; } } }
	const b = t.indexOf('{', p); let d = 0, seen = false, j = b;
	for (; j < t.length; j++) { const c = t[j]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { j++; break; } } }
	return t.slice(i, j);
}

// Deterministic corpus: well-formed addresses, every compression position, and systematic mutations.
function corpus() {
	const out = new Set();
	const hextets = ['0', '1', 'a', 'ff', '0000', 'abcd', '2001', 'db8', 'ffff'];
	// Fully written-out addresses.
	for (const h of hextets) out.add(new Array(8).fill(h).join(':'));
	out.add('2001:0db8:0000:0000:0000:0000:0000:0001');
	out.add('fe80:0:0:0:0:0:0:1');
	// Compression at every position, both sides of varying length.
	for (let left = 0; left <= 8; left++) {
		for (let right = 0; right + left <= 8; right++) {
			out.add(new Array(left).fill('1').join(':') + '::' + new Array(right).fill('2').join(':'));
		}
	}
	// IPv4-mapped / embedded forms.
	for (const v4 of ['1.2.3.4', '255.255.255.255', '0.0.0.0', '256.1.1.1', '1.2.3', '1.2.3.4.5']) {
		out.add('::ffff:' + v4);
		out.add('::' + v4);
		out.add('64:ff9b::' + v4);
		out.add('1:2:3:4:5:6:' + v4);
	}
	// Systematic malformations of a known-good base.
	const base = '2001:db8::1';
	for (const bad of [
		':' + base, base + ':', ':::', '1:::2', '::::', base + '::2', '::' + base,
		base.replace('::', ':::'), 'g::1', '::g', '1::2::3', '', ':', '::',
		'12345::1', '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8',
		'1:2:3:4:5:6:7::8', '1:2:3:4:5:6:7:8::', '::1:2:3:4:5:6:7:8',
		'-1::1', '1::-1', ' 2001:db8::1', '2001:db8::1 ', 'not-an-ip', '1.2.3.4',
	]) out.add(bad);
	return [...out];
}

for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');
	const parse = new Function(ex(src, 'stripIPv6Brackets') + ex(src, 'IPv6转字节') + 'return IPv6转字节;')();

	const cases = corpus();
	const falseAccept = [], falseReject = [], threw = [];
	for (const input of cases) {
		let got;
		try { got = parse(input); }
		catch (e) { threw.push(`${JSON.stringify(input)} -> ${e.constructor.name}`); continue; }
		const weAccept = got !== null;
		// Node is the oracle, compared on the TRIMMED input: these values come from configuration text, so
		// stripIPv6Brackets trims deliberately and " 2001:db8::1 " is meant to be accepted. That is the only
		// intentional divergence, and it is asserted explicitly below rather than excluded silently.
		const nodeAccepts = isIPv6(input.trim());
		if (weAccept && !nodeAccepts) falseAccept.push(input);
		if (!weAccept && nodeAccepts) falseReject.push(input);
		// Anything accepted must be exactly 16 octets.
		if (weAccept) assert.equal(got.byteLength, 16, `${file}: ${input} produced ${got.byteLength} bytes`);
	}

	assert.deepEqual(threw, [], `${file}: IPv6转字节 must never throw; it returned via exception for:\n  ${threw.join('\n  ')}`);
	assert.deepEqual(falseAccept, [],
		`${file}: accepted ${falseAccept.length} address(es) Node rejects — a malformed literal would be dialled as a different valid one:\n  ${falseAccept.join('\n  ')}`);
	assert.deepEqual(falseReject, [],
		`${file}: rejected ${falseReject.length} address(es) Node accepts:\n  ${falseReject.join('\n  ')}`);

	// Semantic spot-checks the oracle cannot express: compression must expand to the same bytes.
	const a = parse('2001:0db8:0000:0000:0000:0000:0000:0001');
	const b = parse('2001:db8::1');
	assert.deepEqual([...a], [...b], `${file}: compressed and expanded forms must encode identically`);
	assert.deepEqual([...parse('::')], new Array(16).fill(0), `${file}: :: is the all-zero address`);
	assert.deepEqual([...parse('::ffff:1.2.3.4')].slice(-6), [0xff, 0xff, 1, 2, 3, 4], `${file}: IPv4-mapped tail`);
	// The one intentional divergence from net.isIPv6: config values are trimmed.
	assert.deepEqual([...parse('  2001:db8::1  ')], [...b], `${file}: surrounding whitespace is trimmed by design`);

	console.log(`  ${file}: ${cases.length} cases, 0 divergences from net.isIPv6`);
}

console.log('ipv6 differential tests passed');
