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
	// IPv4-mapped / embedded forms. A 106-case corpus missed "::ffff:01.2.3.4" -- a leading zero in the
	// dotted tail -- so the octet spellings are now generated systematically rather than listed. Leading
	// zeros, out-of-range values, wrong arity and non-digits all have to be covered.
	const octets = ['0', '1', '9', '10', '99', '100', '255', '256', '00', '01', '007', '0255', '1000', '', 'a', '-1', '+1', ' 1'];
	for (const o of octets) {
		out.add(`::ffff:${o}.2.3.4`);
		out.add(`::ffff:1.${o}.3.4`);
		out.add(`::ffff:1.2.3.${o}`);
	}
	for (const v4 of ['1.2.3.4', '255.255.255.255', '0.0.0.0', '256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', '1.02.3.4', '1.2.3.04']) {
		out.add('::ffff:' + v4);
		out.add('::' + v4);
		out.add('64:ff9b::' + v4);
		out.add('1:2:3:4:5:6:' + v4);
		out.add('1:2:3:4:5:6:7:' + v4);
	}
	// Exhaustive hextet spellings, including over-long and non-hex.
	for (const h of ['0', '00', '000', '0000', '00000', '1', 'ffff', 'fffff', 'g', '0x1', '-1', '+1', ' 1', '1 ']) {
		out.add(`${h}:2:3:4:5:6:7:8`);
		out.add(`1:2:3:4:5:6:7:${h}`);
		out.add(`${h}::1`);
		out.add(`1::${h}`);
	}
	// Every colon-count variant of a short address, to sweep malformed separators.
	for (let n = 0; n <= 10; n++) out.add('1' + ':'.repeat(n) + '2');
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

// validateTunnelTarget must reject every address a tunnel can never usefully reach. Each of these was
// ACCEPTED before byte-based classification replaced the string-prefix rules, so a client asking for one
// spent a full dial attempt plus its timeout before failing. The must-allow half of the table matters just
// as much: over-blocking here silently breaks real destinations, which is far worse than the gap it fixes.
{
	const BLOCK = [
		['224.0.0.1', 'IPv4 multicast 224/4'],
		['239.255.255.250', 'IPv4 multicast (SSDP)'],
		['240.0.0.1', 'IPv4 reserved 240/4'],
		['255.255.255.255', 'IPv4 broadcast'],
		['192.0.2.1', 'TEST-NET-1'],
		['198.51.100.1', 'TEST-NET-2'],
		['203.0.113.1', 'TEST-NET-3'],
		['192.88.99.1', '6to4 relay anycast'],
		['::127.0.0.1', 'IPv4-compatible IPv6 loopback'],
		['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
		['64:ff9b::7f00:1', 'NAT64-embedded loopback'],
		['ff02::1', 'IPv6 multicast'],
		['ff05::1:3', 'IPv6 multicast'],
		['2001:db8::1', 'IPv6 documentation'],
		['100::1', 'IPv6 discard-only'],
		['fe80::1', 'IPv6 link-local'],
		['fc00::1', 'IPv6 unique-local'],
		['::1', 'IPv6 loopback'],
		['::', 'IPv6 unspecified'],
		['127.0.0.1', 'IPv4 loopback'],
		['10.0.0.1', 'RFC1918'],
		['169.254.1.1', 'IPv4 link-local'],
		['100.64.0.1', 'CGNAT'],
		['999.1.1.1', 'non-numeric-TLD guard'],
		['01.2.3.4', 'leading-zero octet reads as octal to some resolvers'],
		['192.0.0.1', 'IETF protocol assignments 192.0.0.0/24'],
		['192.0.0.171', 'NAT64 discovery, still not a destination'],
		['64:ff9b:1::8.8.8.8', 'RFC 8215 local-use translation prefix, NOT the well-known one'],
		['100:0:0:1::1', 'dummy address 100:0:0:1::/64'],
		['2001:2::1', 'benchmarking 2001:2::/48'],
		['3fff::1', 'documentation 3fff::/20'],
		['5f00::1', 'SRv6 SIDs 5f00::/16'],
	];
	const ALLOW = [
		['1.1.1.1', 'public resolver'],
		['8.8.8.8', 'public resolver'],
		['142.250.185.78', 'google'],
		['223.255.255.255', 'last unicast address before multicast'],
		['2606:4700:4700::1111', 'public IPv6 resolver'],
		['2a03:2880:f10c::', 'public IPv6'],
		['example.com', 'domain'],
		['www.youtube.com', 'domain'],
		// IANA carve-outs INSIDE blocked space. These are the cases a broad prefix rule silently breaks,
		// which is why the allow half of this table exists at all.
		['192.0.0.9', 'PCP anycast -- globally reachable inside 192.0.0.0/24'],
		['192.0.0.10', 'NAT64/DNS64 discovery -- globally reachable inside 192.0.0.0/24'],
		['192.0.1.1', 'adjacent /24 is ordinary public space'],
		['192.31.196.1', 'AS112-v4, globally reachable'],
		['192.175.48.1', 'direct-delegation AS112, globally reachable'],
		['64:ff9b::8.8.8.8', 'the WELL-KNOWN NAT64 prefix must keep working'],
		['2001:1::1', 'port control protocol anycast'],
		['2001:4:112::1', 'AS112-v6'],
		['2620:4f:8000::1', 'direct-delegation AS112-v6'],
	];
	// Only the two builds Node can actually load: the wrangler variant imports cloudflare:sockets, which is
	// unresolvable outside the Workers runtime. It is generated from the same source and the connect layer is
	// the only permitted difference, so verify-generated already covers it.
	for (const file of ['_worker_copypaste.js', 'src_static_ui/worker_test.js']) {
		const { __testPerformanceHelpers: H } = await import('../' + file);
		for (const [host, why] of BLOCK) {
			let blocked = false;
			try { H.validateTunnelTarget(host, 443); } catch (e) { blocked = true; }
			assert.equal(blocked, true, `${file}: ${host} must be blocked (${why})`);
		}
		for (const [host, why] of ALLOW) {
			let err = null;
			try { H.validateTunnelTarget(host, 443); } catch (e) { err = e; }
			assert.equal(err, null, `${file}: ${host} must stay reachable (${why}) — over-blocking breaks real traffic`);
		}
		console.log(`  ${file}: ${BLOCK.length} blocked, ${ALLOW.length} allowed`);
	}
}

console.log('ipv6 differential tests passed');
