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
}

{
	const result = spawnSync(process.execPath, ['scripts/live-tunnel-benchmark.mjs'], {
		encoding: 'utf8',
	});
	assert.equal(result.status, 2, 'missing URL/UUID should remain a usage error');
	assert.match(result.stderr, /Usage:/);
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

console.log('tooling tests passed');
