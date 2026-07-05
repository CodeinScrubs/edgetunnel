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
	const result = spawnSync(process.execPath, ['scripts/benchmark-tuning-report.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning report --help should exit successfully');
	assert.match(result.stderr, /--out/);
	assert.match(result.stderr, /--min-runs/);
	assert.match(result.stderr, /recommendations/);
}

{
	const result = spawnSync(process.execPath, ['scripts/plan-tuning-candidates.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning planner --help should exit successfully');
	assert.match(result.stderr, /--baseline-prefix/);
	assert.match(result.stderr, /--candidate-prefix/);
	assert.match(result.stderr, /--transports/);
	assert.match(result.stderr, /one variable/);
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
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-matrix-metadata-'));
	const reportPath = join(dir, 'matrix.json');
	const result = spawnSync(process.execPath, [
		'scripts/live-benchmark-matrix.mjs',
		'--dry-run',
		'--url', 'https://worker.example/',
		'--uuid', '00000000-0000-4000-8000-000000000000',
		'--front-hosts', 'fast.example,backup.example',
		'--profiles', 'latency,burst',
		'--transports', 'grpc,ws,xhttp',
		'--target', 'neverssl.com',
		'--port', '80',
		'--out', reportPath,
	], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'matrix dry-run should save a report without network access');
	const saved = JSON.parse(readFileSync(reportPath, 'utf8'));
	assert.deepEqual(saved.profiles, ['latency', 'burst']);
	assert.deepEqual(saved.frontHosts, ['fast.example', 'backup.example']);
	assert.equal(saved.transports, 'grpc,ws,xhttp');
	assert.equal(saved.target, 'neverssl.com');
	assert.equal(saved.port, '80');
	const summary = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
	assert.deepEqual(summary.profiles, saved.profiles);
	assert.deepEqual(summary.frontHosts, saved.frontHosts);
	assert.equal(summary.transports, saved.transports);
	assert.equal(summary.target, saved.target);
	assert.equal(summary.port, saved.port);
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
		'--label', 'baseline',
		'--transports', 'grpc,ws,xhttp',
	], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'suite dry-run should not require network access');
	assert.match(result.stdout, /--transports grpc,ws,xhttp/);
	assert.match(result.stdout, /--transports grpc --front-hosts sourceforge\.net,www\.modrinth\.com --profiles https/);
	assert.match(result.stdout, /--profiles latency,burst/);
	assert.match(result.stdout, /live-benchmark-matrix\.mjs[\s\S]*--profiles latency,burst[\s\S]*--summary-line/);
	assert.match(result.stdout, /--profiles https/);
	assert.match(result.stdout, /--front-hosts sourceforge\.net,www\.modrinth\.com --profiles download/);
	assert.match(result.stdout, /--front-hosts sourceforge\.net,www\.modrinth\.com --profiles upload/);
	assert.match(result.stdout, /"type": "suite-summary"/);
}

{
	const source = readFileSync('scripts/live-tunnel-benchmark.mjs', 'utf8');
	assert.match(source, /req\.write\(Buffer\.from\(encodeGrpcFrame/, 'gRPC benchmark should keep the upload stream open after the first frame');
	assert.doesNotMatch(source, /req\.end\(Buffer\.from\(encodeGrpcFrame/, 'gRPC benchmark must not half-close the upload stream immediately');
	assert.match(source, /throughputMbps/, 'live benchmark summaries should include throughput so large downloads/uploads can be compared');
	assert.match(source, /firstByteJitterMs/, 'live benchmark summaries should include first-byte jitter/spread for browsing feel');
	assert.match(source, /totalJitterMs/, 'live benchmark summaries should include total latency jitter/spread');
	assert.match(source, /normalizeBenchmarkProfile/, 'live benchmark should have explicit latency/download/upload/burst profiles');
	assert.match(source, /Content-Length: \$\{body\.byteLength\}/, 'upload benchmarks should send a deterministic HTTP body size');
	assert.match(source, /concurrency/, 'live benchmark should support concurrent runs for burst behavior checks');
	assert.match(source, /parseInnerHttpStatus/, 'live benchmark should expose the inner HTTP status from tunneled responses');
	assert.match(source, /status >= 200 && status < 500/, 'live benchmark should treat inner 5xx responses as failed page loads');
	assert.match(source, /measuredTransferBytes/, 'live benchmark should distinguish response bytes from measured transfer bytes');
	assert.match(source, /options\.profile === 'upload'[\s\S]*options\.bodyBytes/, 'upload throughput should use uploaded body bytes, not tiny response bytes');
}

{
	const source = readFileSync('scripts/live-https-benchmark.mjs', 'utf8');
	assert.match(source, /class GrpcTunnelSocket extends Duplex/, 'HTTPS benchmark should expose a virtual socket over gRPC frames');
	assert.match(source, /tls\.connect\(\{[\s\S]*socket: tunnelSocket/, 'HTTPS benchmark should perform a real inner TLS handshake through the tunnel');
	assert.match(source, /makeVlessTcpRequest\(this\.options\.uuid/, 'first TLS bytes should be wrapped in the VLESS TCP request');
	assert.match(source, /tlsP95Ms/, 'HTTPS benchmark should summarize inner TLS handshake latency');
	assert.match(source, /tlsJitterMs/, 'HTTPS benchmark should summarize inner TLS handshake jitter/spread');
	assert.match(source, /firstByteJitterMs/, 'HTTPS benchmark should summarize first-byte jitter/spread');
	assert.match(source, /parseInnerHttpStatus/, 'HTTPS benchmark should expose the inner HTTP status from tunneled responses');
	assert.match(source, /status >= 200 && status < 500/, 'HTTPS benchmark should treat inner 5xx responses as failed page loads');
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
	assert.match(source, /profile: 'download'[\s\S]*?\$\{prefix\}-download\.json/, 'suite should benchmark download throughput across the front-host matrix');
	assert.match(source, /profile: 'upload'[\s\S]*?\$\{prefix\}-upload\.json/, 'suite should benchmark upload throughput across the front-host matrix');
	assert.match(source, /transports/, 'suite should let benchmark runs compare grpc/ws/xhttp when requested');
	assert.match(source, /label/, 'suite should store a human label for baseline/candidate tuning runs');
	assert.match(source, /targets/, 'suite should store benchmark target metadata');
	assert.doesNotMatch(source, /command\.includes\('live-benchmark-matrix\.mjs'\)/, 'suite must fail when a matrix benchmark command fails');
	assert.match(source, /suite-summary/, 'suite should emit a compact summary');
}

{
	const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
	assert.match(pkg.scripts.check, /^npm run verify-generated &&/, 'check must detect stale _worker.js before any build rewrites it');
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
	assert.ok((source.match(/new ByteLengthQueuingStrategy\(\{ highWaterMark: getDownlinkBackpressureHwm\(/g) || []).length >= 2,
		'gRPC and XHTTP response streams must use a bounded backpressure strategy');
	assert.match(source, /function getDownlinkBackpressureHwm\(env\)[\s\S]*?return 下行背压高水位字节/,
		'backpressure HWM is env-tunable but falls back to the bounded default');
	assert.match(source, /return 等待下行可写\(\)/, 'downstream bridge must apply pull-based backpressure (wait until the stream drains)');
	assert.match(source, /webSocket\.bufferedAmount > bufferedLimit/, 'WebSocket downstream must pace against bufferedAmount');
	assert.match(source, /function getWsBufferedAmountLimitBytes\(env\)[\s\S]*?return WS缓冲上限字节/,
		'WS bufferedAmount limit is env-tunable but falls back to the bounded default');
	assert.match(source, /Stitch them back onto the front of the stream/, 'SOCKS5 must preserve bundled target-response bytes');
	assert.match(source, /this\.handshakeComplete = !0, this\.timeout = 0/, 'TlsClient must drop its per-read timeout after the handshake');
	assert.match(source, /判断协议类型 === null && !isDnsQuery && 有效数据长度\(chunk\) === 0/, 'empty pre-handshake WS frames must be ignored before the parser');
	// Tunneled DNS uses DoH (application/dns-message) primary, DNS-over-TCP fallback.
	assert.match(source, /application\/dns-message/, 'tunneled DNS must forward via DoH (application/dns-message)');
	assert.match(source, /DNS经 DoH转发|DNS经DoH转发/, 'DoH DNS forwarder must exist');
	assert.match(source, /falling back to DNS-over-TCP/, 'DoH must fall back to DNS-over-TCP on failure');
	assert.match(source, /XHTTP_FIRST_PACKET_MAX_BYTES/, 'XHTTP first-packet parsing must have a hard byte cap');
	assert.match(source, /offset \+ chunk\.byteLength > XHTTP_FIRST_PACKET_MAX_BYTES/, 'XHTTP cap must be checked before growing the first-packet buffer');
	assert.match(source, /typeof event\.data === 'string'/, 'WebSocket tunnel must explicitly reject text frames');
	assert.match(source, /async handshakeTls13[\s\S]*?extractLeafCertificate\(message\.body, 1\)/, 'TLS 1.3 certificate parsing must skip the certificate_request_context byte');
	const ungatedConsoleWarnings = source
		.split('\n')
		.filter(line => /console\.(?:warn|error)\(/.test(line) && !/if \(调试日志打印\) console\.(?:warn|error)\(/.test(line));
	assert.deepEqual(ungatedConsoleWarnings, [], 'worker must not emit ungated console.warn/error output');
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
			{
				scenario: { profile: 'burst', frontHost: 'jitter.example' },
				summary: { summary: [{ transport: 'grpc', runs: 10, acceptRate: 1, successRate: 1, firstByteP50Ms: 180, firstByteP95Ms: 900, firstByteJitterMs: 720, totalP95Ms: 1200 }] },
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
	assert.equal(parsed.signals.some(signal => /First-byte jitter/.test(signal.message)), true);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-analyze-suite-'));
	const reportPath = join(dir, 'suite.json');
	writeFileSync(reportPath, JSON.stringify({
		scenarios: [
			{
				scenario: { profile: 'latency-burst', frontHost: 'slow.example,fast.example' },
				command: 'node scripts/live-benchmark-matrix.mjs --profiles latency,burst',
				summary: { type: 'summary', summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 9999, totalP95Ms: 9999 }] },
			},
			{
				scenario: { profile: 'latency-burst', frontHost: 'slow.example,fast.example' },
				command: 'node scripts/live-benchmark-matrix.mjs --profiles latency,burst',
				summary: {
					type: 'matrix-summary',
					ranked: [
						{
							rank: 1,
							scenario: { profile: 'latency', frontHost: 'fast.example' },
							summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 350, totalP95Ms: 800 }],
						},
						{
							rank: 2,
							scenario: { profile: 'burst', frontHost: 'fast.example' },
							summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 500, totalP95Ms: 1200 }],
						},
					],
				},
			},
		],
	}));
	const result = spawnSync(process.execPath, ['scripts/analyze-benchmark-report.mjs', reportPath, '--json', '--min-runs', '10'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'analyzer should parse current suite matrix-summary reports');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.ranked.some(entry => entry.profile === 'latency-burst'), false, 'analyzer should ignore old matrix wrapper aggregate rows');
	assert.equal(parsed.ranked.some(entry => entry.profile === 'latency' && entry.frontHost === 'fast.example'), true, 'analyzer should expand latency matrix-summary rows');
	assert.equal(parsed.ranked.some(entry => entry.profile === 'burst' && entry.frontHost === 'fast.example'), true, 'analyzer should expand burst matrix-summary rows');
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
	writeFileSync(baselinePath, makeReport({ tlsP95Ms: 800, firstByteP95Ms: 500, firstByteJitterMs: 120, totalP95Ms: 1500, totalJitterMs: 300, throughputP50Mbps: 1 }));
	writeFileSync(betterPath, makeReport({ tlsP95Ms: 700, firstByteP95Ms: 420, firstByteJitterMs: 100, totalP95Ms: 1200, totalJitterMs: 250, throughputP50Mbps: 1.2 }));
	writeFileSync(worsePath, makeReport({ tlsP95Ms: 1300, firstByteP95Ms: 900, firstByteJitterMs: 400, totalP95Ms: 2200, totalJitterMs: 900, throughputP50Mbps: 0.7 }));

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
	assert.equal(JSON.parse(worse.stdout).failures.some(item => /firstByteJitter/.test(item.message)), true);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-compare-metadata-'));
	const baselinePath = join(dir, 'baseline-suite.json');
	const candidatePath = join(dir, 'candidate-suite.json');
	const makeSuite = httpTarget => JSON.stringify({
		frontHosts: ['fast.example'],
		transports: 'grpc',
		targets: { http: httpTarget, https: 'example.com', benchmark: 'bench.example' },
		scenarios: [{
			scenario: { profile: 'latency', frontHost: 'fast.example' },
			summary: { summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 450, totalP95Ms: 900 }] },
		}],
	});
	writeFileSync(baselinePath, makeSuite('neverssl.com'));
	writeFileSync(candidatePath, makeSuite('different-target.example'));
	const result = spawnSync(process.execPath, ['scripts/compare-benchmark-reports.mjs', '--baseline', baselinePath, '--candidate', candidatePath, '--json'], {
		encoding: 'utf8',
	});
	assert.notEqual(result.status, 0, 'comparator should fail when suite benchmark targets differ');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.verdict, 'fail');
	assert.equal(parsed.metadataMismatches.some(item => item.field === 'targets.http'), true);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-compare-matrix-metadata-'));
	const baselinePath = join(dir, 'baseline-matrix.json');
	const candidatePath = join(dir, 'candidate-matrix.json');
	const makeMatrix = metadata => JSON.stringify({
		profiles: metadata.profiles,
		frontHosts: ['fast.example'],
		transports: 'grpc',
		target: metadata.target,
		port: metadata.port,
		scenarios: [{
			scenario: { profile: 'latency', frontHost: 'fast.example' },
			summary: { summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 450, totalP95Ms: 900 }] },
		}],
	});
	writeFileSync(baselinePath, makeMatrix({ profiles: ['latency'], target: 'neverssl.com', port: '80' }));
	writeFileSync(candidatePath, makeMatrix({ profiles: ['burst'], target: 'example.com', port: '443' }));
	const result = spawnSync(process.execPath, ['scripts/compare-benchmark-reports.mjs', '--baseline', baselinePath, '--candidate', candidatePath, '--json'], {
		encoding: 'utf8',
	});
	assert.notEqual(result.status, 0, 'comparator should fail when standalone matrix metadata differs');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.metadataMismatches.some(item => item.field === 'profiles'), true);
	assert.equal(parsed.metadataMismatches.some(item => item.field === 'target'), true);
	assert.equal(parsed.metadataMismatches.some(item => item.field === 'port'), true);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-compare-empty-'));
	const baselinePath = join(dir, 'empty-baseline.json');
	const candidatePath = join(dir, 'empty-candidate.json');
	writeFileSync(baselinePath, JSON.stringify({ scenarios: [] }));
	writeFileSync(candidatePath, JSON.stringify({ scenarios: [] }));
	const result = spawnSync(process.execPath, ['scripts/compare-benchmark-reports.mjs', '--baseline', baselinePath, '--candidate', candidatePath, '--json'], {
		encoding: 'utf8',
	});
	assert.notEqual(result.status, 0, 'comparator should fail when no matching scenarios are compared');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.verdict, 'fail');
	assert.equal(parsed.failures.some(item => /No comparable/.test(item.message)), true);
}

{
	const source = readFileSync('scripts/compare-benchmark-reports.mjs', 'utf8');
	assert.match(source, /maxLatencyRegressionPct/, 'comparator should enforce latency regression thresholds');
	assert.match(source, /tlsP95DeltaPct/, 'comparator should enforce HTTPS TLS regression thresholds');
	assert.match(source, /maxThroughputRegressionPct/, 'comparator should enforce throughput regression thresholds');
	assert.match(source, /verdict/, 'comparator should emit a pass/fail verdict');
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-plan-'));
	const reportPath = join(dir, 'baseline-tuning.json');
	writeFileSync(reportPath, JSON.stringify({
		bestByProfile: [
			{ profile: 'latency', transport: 'grpc', best: { frontHost: 'fast.example', firstByteP95Ms: 1200, successRate: 1, acceptRate: 1 } },
			{ profile: 'burst', transport: 'grpc', best: { frontHost: 'fast.example', firstByteP95Ms: 900, successRate: 1, acceptRate: 1 } },
			{ profile: 'https', transport: 'grpc', best: { frontHost: 'fast.example', tlsP95Ms: 850, firstByteP95Ms: 1000, successRate: 1, acceptRate: 1 } },
			{ profile: 'download', transport: 'grpc', best: { frontHost: 'fast.example', throughputP50Mbps: 3.2, successRate: 1, acceptRate: 1 } },
		],
		ranked: [
			{ profile: 'latency', transport: 'grpc', frontHost: 'fast.example', runs: 30, acceptRate: 1, successRate: 1, firstByteP95Ms: 1200 },
			{ profile: 'download', transport: 'grpc', frontHost: 'fast.example', runs: 10, acceptRate: 1, successRate: 1, throughputP50Mbps: 3.2 },
		],
		recommendations: [{ category: 'latency', priority: 'high' }],
	}));
	const result = spawnSync(process.execPath, [
		'scripts/plan-tuning-candidates.mjs',
		reportPath,
		'--json',
		'--url', 'https://worker.example/',
		'--uuid', '00000000-0000-4000-8000-000000000000',
		'--front-hosts', 'fast.example,backup.example',
		'--sni', 'worker.example',
		'--authority', 'worker.example',
		'--transports', 'grpc,ws,xhttp',
		'--bench-target', 'bench.example',
	], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning planner should create one-variable candidate experiments from a clean baseline');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.blocked, false);
	assert.equal(parsed.candidates.some(item => item.env.DIAL_STAGGER_MS === '0'), true);
	assert.equal(parsed.candidates.some(item => item.env.CONNECT_TIMEOUT_MS === '700'), true);
	assert.equal(parsed.candidates.some(item => item.env.DOWNLINK_BACKPRESSURE_HWM_BYTES === '524288'), true);
	assert.equal(parsed.candidates.every(item => Object.keys(item.env).length === 1), true, 'each candidate must change one variable only');
	assert.equal(parsed.candidates.some(item => /bench:suite/.test(item.runCommand) && /bench:compare/.test(item.compareCommand)), true);
	assert.equal(parsed.candidates.every(item => /-download\.json/.test(item.tuneCommand) && /-upload\.json/.test(item.tuneCommand)), true,
		'tuning commands should include throughput matrix reports');
	assert.equal(parsed.candidates.every(item => !/^[A-Z_]+=/.test(item.runCommand)), true, 'benchmark command must not pretend local env vars tune the deployed Worker');
	assert.equal(parsed.candidates.every(item => /redeploy/i.test(item.applyInstruction)), true, 'candidate plan must instruct redeploy before benchmarking');
	assert.equal(parsed.candidates.every(item => /--transports grpc,ws,xhttp/.test(item.runCommand)), true, 'candidate commands should preserve the requested transport list');
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-plan-blocked-'));
	const reportPath = join(dir, 'blocked-tuning.json');
	writeFileSync(reportPath, JSON.stringify({
		bestByProfile: [],
		ranked: [{ profile: 'burst', transport: 'grpc', frontHost: 'bad.example', runs: 30, acceptRate: 1, successRate: 0.9, firstByteP95Ms: 1400 }],
		recommendations: [{ category: 'reliability', priority: 'critical', title: 'Fix reliability first' }],
	}));
	const result = spawnSync(process.execPath, ['scripts/plan-tuning-candidates.mjs', reportPath, '--json'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning planner should return a blocked plan instead of failing');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.blocked, true);
	assert.equal(parsed.candidates.length, 0);
	assert.match(parsed.blockers.join('\n'), /reliability/i);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-plan-scoped-'));
	const reportPath = join(dir, 'scoped-tuning.json');
	writeFileSync(reportPath, JSON.stringify({
		bestByProfile: [
			{ profile: 'latency', transport: 'grpc', best: { frontHost: 'fast.example', firstByteP95Ms: 1200, successRate: 1, acceptRate: 1 } },
			{ profile: 'burst', transport: 'grpc', best: { frontHost: 'fast.example', firstByteP95Ms: 900, successRate: 1, acceptRate: 1 } },
			{ profile: 'https', transport: 'grpc', best: { frontHost: 'fast.example', tlsP95Ms: 850, firstByteP95Ms: 1000, successRate: 1, acceptRate: 1 } },
			{ profile: 'latency', transport: 'ws', best: { frontHost: 'dead.example', firstByteP95Ms: 0, successRate: 0, acceptRate: 0 } },
		],
		ranked: [
			{ profile: 'latency', transport: 'grpc', frontHost: 'fast.example', runs: 30, acceptRate: 1, successRate: 1, firstByteP95Ms: 1200 },
			{ profile: 'burst', transport: 'grpc', frontHost: 'fast.example', runs: 30, acceptRate: 1, successRate: 1, firstByteP95Ms: 900 },
			{ profile: 'https', transport: 'grpc', frontHost: 'fast.example', runs: 10, acceptRate: 1, successRate: 1, tlsP95Ms: 850, firstByteP95Ms: 1000 },
			{ profile: 'latency', transport: 'ws', frontHost: 'dead.example', runs: 30, acceptRate: 0, successRate: 0, firstByteP95Ms: 0 },
		],
		recommendations: [{ category: 'reliability', priority: 'critical', title: 'Fix reliability before speed tuning for latency/ws/dead.example' }],
	}));
	const result = spawnSync(process.execPath, ['scripts/plan-tuning-candidates.mjs', reportPath, '--json', '--transports', 'grpc', '--front-hosts', 'fast.example'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning planner should scope reliability checks to selected transports and front hosts');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.blocked, false);
	assert.equal(parsed.candidates.length > 0, true);
	assert.equal(parsed.candidates.every(item => /--transports grpc/.test(item.runCommand)), true);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-plan-weak-data-'));
	const reportPath = join(dir, 'weak-data-tuning.json');
	writeFileSync(reportPath, JSON.stringify({
		bestByProfile: [
			{ profile: 'latency', transport: 'grpc', best: { frontHost: 'fast.example', firstByteP95Ms: 1200, successRate: 1, acceptRate: 1 } },
			{ profile: 'burst', transport: 'grpc', best: { frontHost: 'fast.example', firstByteP95Ms: 900, successRate: 1, acceptRate: 1 } },
			{ profile: 'https', transport: 'grpc', best: { frontHost: 'fast.example', tlsP95Ms: 850, firstByteP95Ms: 1000, successRate: 1, acceptRate: 1 } },
		],
		ranked: [{ profile: 'latency', transport: 'grpc', frontHost: 'fast.example', runs: 3, acceptRate: 1, successRate: 1, firstByteP95Ms: 1200 }],
		recommendations: [{ category: 'data-quality', priority: 'high', title: 'Collect more samples' }],
	}));
	const result = spawnSync(process.execPath, ['scripts/plan-tuning-candidates.mjs', reportPath, '--json'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning planner should block instead of proposing candidates from weak samples');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.blocked, true);
	assert.equal(parsed.candidates.length, 0);
	assert.match(parsed.blockers.join('\n'), /sample|data/i);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-plan-coverage-'));
	const reportPath = join(dir, 'coverage-tuning.json');
	writeFileSync(reportPath, JSON.stringify({
		bestByProfile: [
			{ profile: 'latency', transport: 'grpc', best: { frontHost: 'fast.example', firstByteP95Ms: 1200, successRate: 1, acceptRate: 1 } },
		],
		ranked: [{ profile: 'latency', transport: 'grpc', frontHost: 'fast.example', runs: 30, acceptRate: 1, successRate: 1, firstByteP95Ms: 1200 }],
		recommendations: [
			{ category: 'coverage', priority: 'medium', title: 'Add burst benchmarks' },
			{ category: 'coverage', priority: 'medium', title: 'Add HTTPS browsing benchmarks' },
		],
	}));
	const result = spawnSync(process.execPath, ['scripts/plan-tuning-candidates.mjs', reportPath, '--json'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning planner should block until core benchmark coverage exists');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.blocked, true);
	assert.equal(parsed.candidates.length, 0);
	assert.match(parsed.blockers.join('\n'), /coverage|burst|HTTPS/i);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-tuning-'));
	const reportPath = join(dir, 'suite.json');
	const outPath = join(dir, 'decision.json');
	writeFileSync(reportPath, JSON.stringify({
		generatedAt: '2026-06-17T00:00:00.000Z',
		label: 'baseline',
		scenarios: [
			{
				scenario: { profile: 'latency', frontHost: 'slow.example' },
				summary: { summary: [{ transport: 'grpc', runs: 4, acceptRate: 1, successRate: 1, firstByteP95Ms: 1200, totalP95Ms: 1800, throughputP50Mbps: 0.01 }] },
			},
			{
				scenario: { profile: 'latency', frontHost: 'fast.example' },
				summary: { summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 420, totalP95Ms: 900, throughputP50Mbps: 0.02 }] },
			},
			{
				scenario: { profile: 'burst', frontHost: 'jitter.example' },
				summary: { summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP50Ms: 180, firstByteP95Ms: 950, firstByteJitterMs: 770, totalP95Ms: 1200 }] },
			},
			{
				scenario: { profile: 'burst', frontHost: 'fast.example' },
				summary: { summary: [{ transport: 'grpc', runs: 20, acceptRate: 0.95, successRate: 0.9, firstByteP95Ms: 1100, totalP95Ms: 2600, throughputP50Mbps: 0.02 }] },
			},
			{
				scenario: { profile: 'download', frontHost: 'fast.example' },
				summary: { summary: [{ transport: 'grpc', runs: 10, acceptRate: 1, successRate: 1, firstByteP95Ms: 800, totalP95Ms: 4000, throughputP50Mbps: 3.2 }] },
			},
			{
				scenario: { profile: 'https', frontHost: 'fast.example' },
				summary: { summary: [{ transport: 'grpc', runs: 10, acceptRate: 1, successRate: 1, tlsP95Ms: 1650, firstByteP95Ms: 1900, totalP95Ms: 2500 }] },
			},
			{
				scenario: { profile: 'latency', frontHost: 'dead-a.example' },
				summary: { summary: [{ transport: 'ws', runs: 20, acceptRate: 0, successRate: 0, firstByteP95Ms: 0, totalP95Ms: 0 }] },
			},
			{
				scenario: { profile: 'latency', frontHost: 'dead-b.example' },
				summary: { summary: [{ transport: 'ws', runs: 20, acceptRate: 0, successRate: 0, firstByteP95Ms: 0, totalP95Ms: 0 }] },
			},
		],
	}));
	const result = spawnSync(process.execPath, ['scripts/benchmark-tuning-report.mjs', reportPath, '--json', '--out', outPath, '--min-runs', '10'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning report should parse suite/matrix reports');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.bestByProfile.find(item => item.profile === 'latency').best.frontHost, 'fast.example');
	assert.equal(parsed.recommendations.some(item => item.category === 'reliability'), true);
	assert.equal(parsed.recommendations.some(item => item.category === 'latency'), true);
	assert.equal(parsed.recommendations.some(item => item.category === 'jitter'), true);
	assert.equal(parsed.recommendations.some(item => item.category === 'throughput'), true);
	assert.equal(parsed.recommendations.some(item => item.category === 'data-quality'), true);
	assert.equal(parsed.recommendations.some(item => item.category === 'front-host' && /latency\/ws/.test(item.title)), false,
		'tuning report must not recommend a front host when every candidate for a transport is dead');
	assert.equal(readFileSync(outPath, 'utf8').includes('"recommendations"'), true);
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-coverage-'));
	const reportPath = join(dir, 'coverage.json');
	writeFileSync(reportPath, JSON.stringify({
		scenarios: [
			{
				scenario: { profile: 'latency', frontHost: 'fast.example' },
				summary: { summary: [
					{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 400 },
					{ transport: 'ws', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 450 },
					{ transport: 'xhttp', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 460 },
				] },
			},
			{
				scenario: { profile: 'https', frontHost: 'fast.example' },
				summary: { summary: [
					{ transport: 'grpc', runs: 10, acceptRate: 1, successRate: 1, tlsP95Ms: 800, firstByteP95Ms: 900 },
				] },
			},
		],
	}));
	const result = spawnSync(process.execPath, ['scripts/benchmark-tuning-report.mjs', reportPath, '--json', '--min-runs', '10'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning report should parse mixed transport coverage');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.recommendations.some(item => item.category === 'coverage' && /HTTPS.*ws, xhttp/.test(item.title)), true,
		'tuning report should warn when real HTTPS coverage is missing for measured transports');
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-suite-shapes-'));
	const reportPath = join(dir, 'suite.json');
	writeFileSync(reportPath, JSON.stringify({
		generatedAt: '2026-06-17T00:00:00.000Z',
		label: 'candidate',
		scenarios: [
			{
				scenario: { profile: 'latency-burst', frontHost: 'slow.example,fast.example' },
				command: 'node scripts/live-benchmark-matrix.mjs --profiles latency,burst',
				summary: { type: 'summary', summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 9999, totalP95Ms: 9999 }] },
			},
			{
				scenario: { profile: 'latency-burst', frontHost: 'slow.example,fast.example' },
				command: 'node scripts/live-benchmark-matrix.mjs --profiles latency,burst',
				summary: {
					type: 'matrix-summary',
					ranked: [
						{
							rank: 1,
							scenario: { profile: 'latency', frontHost: 'fast.example' },
							summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 350, totalP95Ms: 800 }],
						},
						{
							rank: 2,
							scenario: { profile: 'burst', frontHost: 'fast.example' },
							summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 500, totalP95Ms: 1200 }],
						},
					],
				},
			},
			{
				scenario: { profile: 'download', frontHost: 'fast.example' },
				command: 'node scripts/live-tunnel-benchmark.mjs --profile download',
				summary: { type: 'summary', summary: [{ transport: 'grpc', runs: 10, acceptRate: 1, successRate: 1, firstByteP95Ms: 700, totalP95Ms: 2000, throughputP50Mbps: 12.5 }] },
			},
		],
	}));
	const result = spawnSync(process.execPath, ['scripts/benchmark-tuning-report.mjs', reportPath, '--json', '--min-runs', '10'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'tuning report should parse current suite matrix-summary shape');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.ranked.some(entry => entry.profile === 'latency-burst'), false, 'old matrix wrapper aggregate rows should not be ranked');
	assert.equal(parsed.ranked.some(entry => entry.profile === 'latency' && entry.frontHost === 'fast.example'), true, 'matrix-summary rows should expand into per-profile scenarios');
	assert.equal(parsed.ranked.some(entry => entry.profile === 'burst' && entry.frontHost === 'fast.example'), true, 'burst matrix-summary rows should be preserved');
	assert.equal(parsed.ranked.some(entry => entry.profile === 'download' && entry.throughputP50Mbps === 12.5), true, 'direct suite throughput summaries should still be preserved');
}

{
	const dir = mkdtempSync(join(tmpdir(), 'edgetunnel-compare-suite-'));
	const baselinePath = join(dir, 'baseline-suite.json');
	const candidatePath = join(dir, 'candidate-suite.json');
	const makeSuite = firstByteP95Ms => JSON.stringify({
		scenarios: [
			{
				scenario: { profile: 'latency-burst', frontHost: 'slow.example,fast.example' },
				command: 'node scripts/live-benchmark-matrix.mjs --profiles latency,burst',
				summary: { type: 'summary', summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms: 9999, totalP95Ms: 9999 }] },
			},
			{
				scenario: { profile: 'latency-burst', frontHost: 'slow.example,fast.example' },
				command: 'node scripts/live-benchmark-matrix.mjs --profiles latency,burst',
				summary: {
					type: 'matrix-summary',
					ranked: [{
						rank: 1,
						scenario: { profile: 'latency', frontHost: 'fast.example' },
						summary: [{ transport: 'grpc', runs: 20, acceptRate: 1, successRate: 1, firstByteP95Ms, totalP95Ms: 900 }],
					}],
				},
			},
		],
	});
	writeFileSync(baselinePath, makeSuite(500));
	writeFileSync(candidatePath, makeSuite(450));
	const result = spawnSync(process.execPath, ['scripts/compare-benchmark-reports.mjs', '--baseline', baselinePath, '--candidate', candidatePath, '--json'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'comparator should parse current suite matrix-summary reports');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.verdict, 'pass');
	assert.equal(parsed.compared, 1);
	assert.equal(parsed.comparisons[0].key, 'latency|grpc|fast.example');
	assert.equal(parsed.missing.length, 0);
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
