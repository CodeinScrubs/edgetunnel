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
}

console.log('tooling tests passed');
