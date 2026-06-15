import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

{
	const result = spawnSync(process.execPath, ['scripts/live-tunnel-benchmark.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, '--help should exit successfully');
	assert.match(result.stderr, /Usage:/);
	assert.match(result.stderr, /--transports all/);
	assert.match(result.stderr, /--front-host/);
	assert.match(result.stderr, /--authority/);
	assert.match(result.stderr, /--sni/);
	assert.match(result.stderr, /--profile latency/);
	assert.match(result.stderr, /--http-path/);
	assert.match(result.stderr, /--body-bytes/);
	assert.match(result.stderr, /--concurrency/);
	assert.match(result.stderr, /--summary-line/);
}

{
	const result = spawnSync(process.execPath, ['scripts/live-benchmark-matrix.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'matrix --help should exit successfully');
	assert.match(result.stderr, /--front-hosts/);
	assert.match(result.stderr, /--profiles/);
	assert.match(result.stderr, /--dry-run/);
}

{
	const result = spawnSync(process.execPath, ['scripts/live-https-benchmark.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'HTTPS benchmark --help should exit successfully');
	assert.match(result.stderr, /--target example\.com/);
	assert.match(result.stderr, /--allow-insecure/);
	assert.match(result.stderr, /--summary-line/);
}

{
	const result = spawnSync(process.execPath, ['scripts/run-benchmark-suite.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'suite --help should exit successfully');
	assert.match(result.stderr, /--bench-target/);
	assert.match(result.stderr, /--https-target/);
}

{
	const result = spawnSync(process.execPath, ['scripts/analyze-benchmark-report.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'analyzer --help should exit successfully');
	assert.match(result.stderr, /--min-runs/);
}

{
	const result = spawnSync(process.execPath, ['scripts/compare-benchmark-reports.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'comparator --help should exit successfully');
	assert.match(result.stderr, /--baseline/);
	assert.match(result.stderr, /--candidate/);
}

{
	const result = spawnSync(process.execPath, ['scripts/live-tunnel-benchmark.mjs'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 2, 'missing URL/UUID should remain a usage error');
	assert.match(result.stderr, /Usage:/);
}

{
	const result = spawnSync(process.execPath, [
		'scripts/live-benchmark-matrix.mjs',
		'--dry-run',
		'--url', 'https://worker.example/',
		'--uuid', '00000000-0000-4000-8000-000000000000',
		'--front-hosts', 'sourceforge.net,www.modrinth.com',
		'--profiles', 'latency,burst,https',
		'--sni', 'worker.example',
		'--authority', 'worker.example',
		'--service-name', '/',
	], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'matrix dry-run should not require network access');
	assert.match(result.stdout, /--front-host sourceforge\.net/);
	assert.match(result.stdout, /--front-host www\.modrinth\.com/);
	assert.match(result.stdout, /--profile latency/);
	assert.match(result.stdout, /--profile burst/);
	assert.match(result.stdout, /scripts\/live-https-benchmark\.mjs/);
	assert.match(result.stdout, /"type": "matrix-summary"/);
}

{
	const result = spawnSync(process.execPath, [
		'scripts/run-benchmark-suite.mjs',
		'--dry-run',
		'--url', 'https://worker.example/',
		'--uuid', '00000000-0000-4000-8000-000000000000',
		'--front-hosts', 'sourceforge.net,www.modrinth.com',
		'--sni', 'worker.example',
		'--authority', 'worker.example',
		'--bench-target', 'bench.example',
	], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'suite dry-run should not require network access');
	assert.match(result.stdout, /--profiles latency,burst/);
	assert.match(result.stdout, /--profiles https/);
	assert.match(result.stdout, /--profile download/);
	assert.match(result.stdout, /--profile upload/);
	assert.match(result.stdout, /"type": "suite-summary"/);
}

{
	const source = readFileSync('scripts/live-tunnel-benchmark.mjs', 'utf8');
	assert.match(source, /req\.write\(Buffer\.from\(encodeGrpcFrame/, 'gRPC benchmark should keep the upload stream open after the first frame');
	assert.doesNotMatch(source, /req\.end\(Buffer\.from\(encodeGrpcFrame/, 'gRPC benchmark must not half-close the upload stream immediately');
	assert.match(source, /throughputMbps/, 'live benchmark summaries should include throughput so large downloads/uploads can be compared');
	assert.match(source, /normalizeBenchmarkProfile/, 'live benchmark should have explicit latency/download/upload/burst profiles');
	assert.match(source, /Content-Length: \$\{body\.byteLength\}/, 'upload benchmarks should send a deterministic HTTP body size');
	assert.match(source, /concurrency/, 'live benchmark should support concurrent runs for burst behavior checks');
}

{
	const source = readFileSync('scripts/live-https-benchmark.mjs', 'utf8');
	assert.match(source, /class GrpcTunnelSocket extends Duplex/, 'HTTPS benchmark should expose a virtual socket over gRPC frames');
	assert.match(source, /tls\.connect\(\{[\s\S]*socket: tunnelSocket/, 'HTTPS benchmark should perform a real inner TLS handshake through the tunnel');
	assert.match(source, /makeVlessTcpRequest\(this\.options\.uuid/, 'first TLS bytes should be wrapped in the VLESS TCP request');
	assert.match(source, /tlsP95Ms/, 'HTTPS benchmark should summarize inner TLS handshake latency');
}

{
	const source = readFileSync('scripts/live-benchmark-matrix.mjs', 'utf8');
	assert.match(source, /parseSummaryLine/, 'matrix runner should consume compact summary lines instead of parsing pretty JSON');
	assert.match(source, /compareScenarioResults/, 'matrix runner should rank front-host/profile scenarios');
	assert.match(source, /writeFileSync\(args\.out/, 'matrix runner should support saving reports for later tuning comparisons');
}

{
	const source = readFileSync('scripts/run-benchmark-suite.mjs', 'utf8');
	assert.match(source, /latency,burst/, 'suite should include latency and burst baseline matrix');
	assert.match(source, /profiles: 'https'/, 'suite should include HTTPS baseline matrix');
	assert.match(source, /bench-target/, 'suite should optionally include deterministic throughput target runs');
	assert.match(source, /suite-summary/, 'suite should emit a compact summary');
}

{
	const source = readFileSync('src/worker.js', 'utf8');
	assert.doesNotMatch(source, /ctx\.waitUntil\(/, 'worker should tolerate runtimes/tests that do not provide ctx.waitUntil');
}

{
	// ProxyIP scanner fully REMOVED: probing Cloudflare IPs from a Worker is flagged as network abuse.
	const source = readFileSync('src/worker.js', 'utf8');
	assert.doesNotMatch(source, /admin\/scanproxyip/, 'worker must NOT expose a ProxyIP scan route');
	assert.doesNotMatch(source, /data-proxyip-scanner/, 'worker must NOT inject a ProxyIP scanner widget');
	assert.doesNotMatch(source, /probeProxyIPCandidates|gatherProxyIPCandidates|runProxyIPScan/, 'worker must NOT contain ProxyIP probing code');
	assert.doesNotMatch(source, /CLOUDFLARE_IPV4_RANGES|isCloudflareIPv4/, 'worker must NOT embed a hardcoded Cloudflare-IP list');
	// No automatic / scheduled scanning either.
	assert.doesNotMatch(source, /async scheduled\(/, 'worker must NOT run a scheduled() auto-scan (network-abuse risk)');
	assert.doesNotMatch(source, /maybeScheduleProxyIPScan/, 'worker must NOT auto-trigger ProxyIP scans');
	const wrangler = readFileSync('wrangler.toml', 'utf8');
	assert.doesNotMatch(wrangler, /\[triggers\]/, 'wrangler.toml must NOT declare a cron trigger (no auto-scan)');
	const cfg = readFileSync('src/core/config.js', 'utf8');
	assert.doesNotMatch(cfg, /PROXYIP_SCAN|CLOUDFLARE_IPV4_RANGES|DEFAULT_NAT64_PREFIX/, 'config must NOT contain scanner/NAT64 defaults');
}

{
	// Connection-drop fixes: downstream backpressure (no isolate OOM on large transfers),
	// SOCKS5 residual stitching, and the TLS client dropping its per-read timeout post-handshake.
	const source = readFileSync('src/worker.js', 'utf8');
	assert.ok((source.match(/new ByteLengthQueuingStrategy\(\{ highWaterMark: 下行背压高水位字节 \}\)/g) || []).length >= 2,
		'gRPC and XHTTP response streams must use a bounded backpressure strategy');
	assert.match(source, /return 等待下行可写\(\)/, 'downstream bridge must apply pull-based backpressure (wait until the stream drains)');
	assert.match(source, /webSocket\.bufferedAmount > WS缓冲上限字节/, 'WebSocket downstream must pace against bufferedAmount');
	assert.match(source, /Stitch them back onto the front of the stream/, 'SOCKS5 must preserve bundled target-response bytes');
	assert.match(source, /this\.handshakeComplete = !0, this\.timeout = 0/, 'TlsClient must drop its per-read timeout after the handshake');
	assert.match(source, /判断协议类型 === null && !isDnsQuery && 有效数据长度\(chunk\) === 0/, 'empty pre-handshake WS frames must be ignored before the parser');
	// Tunneled DNS uses DoH (application/dns-message) primary, DNS-over-TCP fallback.
	assert.match(source, /application\/dns-message/, 'tunneled DNS must forward via DoH (application/dns-message)');
	assert.match(source, /DNS经 DoH转发|DNS经DoH转发/, 'DoH DNS forwarder must exist');
	assert.match(source, /falling back to DNS-over-TCP/, 'DoH must fall back to DNS-over-TCP on failure');
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-bench-'));
	const reportPath = join(dir, 'report.json');
	writeFileSync(reportPath, JSON.stringify({
		scenarios: [
			{
				scenario: { profile: 'latency', frontHost: 'slow.example' },
				summary: { summary: [{ transport: 'grpc', runs: 3, acceptRate: 1, successRate: 1, firstByteP95Ms: 900, totalP95Ms: 1600, throughputP50Mbps: 0.01 }] },
			},
			{
				scenario: { profile: 'latency', frontHost: 'fast.example' },
				summary: { summary: [{ transport: 'grpc', runs: 10, acceptRate: 1, successRate: 1, firstByteP95Ms: 400, totalP95Ms: 900, throughputP50Mbps: 0.02 }] },
			},
			{
				scenario: { profile: 'https', frontHost: 'fast.example' },
				summary: { summary: [{ transport: 'grpc', runs: 10, acceptRate: 1, successRate: 1, tlsP95Ms: 700, firstByteP95Ms: 850, totalP95Ms: 1000 }] },
			},
		],
	}));
	const result = spawnSync(process.execPath, ['scripts/analyze-benchmark-report.mjs', reportPath, '--json', '--min-runs', '5'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'analyzer should parse matrix reports');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.bestByProfile[0].best.frontHost, 'fast.example');
	assert.equal(parsed.ranked.some(entry => entry.tlsP95Ms === 700), true);
	assert.equal(parsed.signals.some(signal => /Only 3 runs/.test(signal.message)), true);
}

{
	const source = readFileSync('scripts/analyze-benchmark-report.mjs', 'utf8');
	assert.match(source, /makeSignals/, 'analyzer should turn raw metrics into tuning signals');
	assert.match(source, /bestByProfile/, 'analyzer should report the best scenario per profile and transport');
	assert.match(source, /tlsP95Ms/, 'analyzer should preserve HTTPS inner TLS metrics');
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-compare-'));
	const baselinePath = join(dir, 'baseline.json');
	const betterPath = join(dir, 'better.json');
	const worsePath = join(dir, 'worse.json');
	const makeReport = summary => JSON.stringify({
		scenarios: [{
			scenario: { profile: 'latency', frontHost: 'sourceforge.net' },
			summary: { summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, ...summary }] },
		}],
	});
	writeFileSync(baselinePath, makeReport({ tlsP95Ms: 800, firstByteP95Ms: 500, totalP95Ms: 1500, throughputP50Mbps: 1 }));
	writeFileSync(betterPath, makeReport({ tlsP95Ms: 700, firstByteP95Ms: 420, totalP95Ms: 1200, throughputP50Mbps: 1.2 }));
	writeFileSync(worsePath, makeReport({ tlsP95Ms: 1300, firstByteP95Ms: 900, totalP95Ms: 2200, throughputP50Mbps: 0.7 }));

	const better = spawnSync(process.execPath, ['scripts/compare-benchmark-reports.mjs', '--baseline', baselinePath, '--candidate', betterPath, '--json'], {
		encoding: 'utf8',
	});
	assert.equal(better.status, 0, 'better candidate should pass comparator');
	assert.equal(JSON.parse(better.stdout).verdict, 'pass');

	const worse = spawnSync(process.execPath, ['scripts/compare-benchmark-reports.mjs', '--baseline', baselinePath, '--candidate', worsePath, '--json'], {
		encoding: 'utf8',
	});
	assert.notEqual(worse.status, 0, 'regressed candidate should fail comparator');
	assert.equal(JSON.parse(worse.stdout).verdict, 'fail');
}

{
	const source = readFileSync('scripts/compare-benchmark-reports.mjs', 'utf8');
	assert.match(source, /maxLatencyRegressionPct/, 'comparator should enforce latency regression thresholds');
	assert.match(source, /tlsP95DeltaPct/, 'comparator should enforce HTTPS TLS regression thresholds');
	assert.match(source, /maxThroughputRegressionPct/, 'comparator should enforce throughput regression thresholds');
	assert.match(source, /verdict/, 'comparator should emit a pass/fail verdict');
}

{
	const source = readFileSync('benchmarks/target-worker.js', 'utf8');
	assert.match(source, /\/bytes/, 'benchmark target should expose deterministic download endpoint');
	assert.match(source, /\/sink/, 'benchmark target should expose upload sink endpoint');
	assert.match(source, /ReadableStream/, 'benchmark target downloads should stream instead of allocating one giant response');
	assert.match(source, /cache-control/, 'benchmark target responses should disable cache for throughput tests');
}

{
	const source = readFileSync('benchmarks/wrangler.benchmark-target.toml', 'utf8');
	assert.match(source, /main = "target-worker\.js"/);
	assert.match(source, /name = "edgetunnel-benchmark-target"/);
}

console.log('tooling tests passed');
