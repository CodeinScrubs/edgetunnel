import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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

console.log('tooling tests passed');
