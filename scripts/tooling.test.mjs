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
	const result = spawnSync(process.execPath, ['scripts/analyze-benchmark-report.mjs', '--help'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'analyzer --help should exit successfully');
	assert.match(result.stderr, /--min-runs/);
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
		'--profiles', 'latency,burst',
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
	assert.match(result.stdout, /"type": "matrix-summary"/);
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
	const source = readFileSync('scripts/live-benchmark-matrix.mjs', 'utf8');
	assert.match(source, /parseSummaryLine/, 'matrix runner should consume compact summary lines instead of parsing pretty JSON');
	assert.match(source, /compareScenarioResults/, 'matrix runner should rank front-host/profile scenarios');
	assert.match(source, /writeFileSync\(args\.out/, 'matrix runner should support saving reports for later tuning comparisons');
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
		],
	}));
	const result = spawnSync(process.execPath, ['scripts/analyze-benchmark-report.mjs', reportPath, '--json', '--min-runs', '5'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, 'analyzer should parse matrix reports');
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.bestByProfile[0].best.frontHost, 'fast.example');
	assert.equal(parsed.signals.some(signal => /Only 3 runs/.test(signal.message)), true);
}

{
	const source = readFileSync('scripts/analyze-benchmark-report.mjs', 'utf8');
	assert.match(source, /makeSignals/, 'analyzer should turn raw metrics into tuning signals');
	assert.match(source, /bestByProfile/, 'analyzer should report the best scenario per profile and transport');
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
