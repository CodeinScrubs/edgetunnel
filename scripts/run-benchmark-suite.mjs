import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
	const out = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith('--')) continue;
		const key = arg.slice(2);
		const next = argv[i + 1];
		out[key] = next && !next.startsWith('--') ? argv[++i] : '1';
	}
	return out;
}

function usage() {
	console.error([
		'Usage:',
		'  node scripts/run-benchmark-suite.mjs --url https://your-worker.example/ --uuid your-vless-uuid --front-hosts sourceforge.net,www.modrinth.com --sni your-worker.example --authority your-worker.example',
		'',
		'Options:',
		'  --dry-run                 Print commands without running them',
		'  --out-dir benchmark-runs  Directory for JSON reports',
		'  --prefix baseline         Report file prefix',
		'  --front-hosts a,b         Clean/front hosts to compare',
		'  --http-target host        Plain HTTP small-response target, default neverssl.com',
		'  --https-target host       HTTPS browsing target, default example.com',
		'  --bench-target host       Optional deterministic benchmark target for download/upload',
		'  --runs 30                 Latency/burst runs',
		'  --https-runs 10           HTTPS runs',
		'  --throughput-runs 10      Download/upload runs',
		'  --download-bytes 1048576  Benchmark target download size',
		'  --upload-bytes 1048576    Upload body size',
	].join('\n'));
}

function addFlag(args, name, value) {
	if (value === undefined || value === null || value === '') return;
	args.push(`--${name}`, String(value));
}

function commandText(args) {
	return `node ${args.join(' ')}`;
}

function parseSummaryLine(stdout) {
	const lines = String(stdout || '').trim().split(/\r?\n/).reverse();
	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);
			if (parsed?.type === 'summary' && Array.isArray(parsed.summary)) return parsed;
		} catch {}
	}
	return null;
}

function buildMatrixCommand(options, { profiles, target, port, runs, out }) {
	const commandArgs = ['scripts/live-benchmark-matrix.mjs'];
	for (const name of ['url', 'uuid', 'sni', 'authority']) addFlag(commandArgs, name, options[name]);
	addFlag(commandArgs, 'transports', 'grpc');
	addFlag(commandArgs, 'front-hosts', options['front-hosts']);
	addFlag(commandArgs, 'profiles', profiles);
	addFlag(commandArgs, 'runs', runs);
	addFlag(commandArgs, 'service-name', options['service-name']);
	addFlag(commandArgs, 'target', target);
	addFlag(commandArgs, 'port', port);
	addFlag(commandArgs, 'out', out);
	return commandArgs;
}

function buildLiveCommand(options, { profile, target, port, httpPath, httpMethod, bodyBytes, runs }) {
	const commandArgs = ['scripts/live-tunnel-benchmark.mjs'];
	for (const name of ['url', 'uuid', 'sni', 'authority']) addFlag(commandArgs, name, options[name]);
	addFlag(commandArgs, 'transports', 'grpc');
	addFlag(commandArgs, 'front-host', options.primaryFrontHost);
	addFlag(commandArgs, 'profile', profile);
	addFlag(commandArgs, 'runs', runs);
	addFlag(commandArgs, 'service-name', options['service-name']);
	addFlag(commandArgs, 'target', target);
	addFlag(commandArgs, 'port', port);
	addFlag(commandArgs, 'http-path', httpPath);
	addFlag(commandArgs, 'http-method', httpMethod);
	addFlag(commandArgs, 'body-bytes', bodyBytes);
	addFlag(commandArgs, 'timeout', 30000);
	commandArgs.push('--summary-line');
	return commandArgs;
}

function runCommand(commandArgs, dryRun) {
	if (dryRun) {
		console.log(commandText(commandArgs));
		return { dryRun: true, command: commandText(commandArgs) };
	}
	const result = spawnSync(process.execPath, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
	process.stdout.write(result.stdout);
	return {
		command: commandText(commandArgs),
		exitCode: result.status,
		summary: parseSummaryLine(result.stdout),
		error: result.error?.message || null,
	};
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
	usage();
	process.exit(0);
}

const url = args.url || process.env.TUNNEL_BENCH_URL || process.env.GRPC_BENCH_URL;
const uuid = args.uuid || process.env.TUNNEL_BENCH_UUID || process.env.GRPC_BENCH_UUID;
const dryRun = ['1', 'true'].includes(String(args['dry-run'] || '').toLowerCase());
if ((!url || !uuid || !args['front-hosts']) && !dryRun) {
	usage();
	process.exit(2);
}

const outDir = args['out-dir'] || 'benchmark-runs';
const prefix = args.prefix || 'baseline';
const frontHosts = args['front-hosts'] || 'sourceforge.net,www.modrinth.com';
const primaryFrontHost = frontHosts.split(',').map(item => item.trim()).filter(Boolean)[0] || '';
const options = {
	...args,
	url,
	uuid,
	'front-hosts': frontHosts,
	primaryFrontHost,
	'service-name': args['service-name'] || '/',
};
if (!dryRun) mkdirSync(outDir, { recursive: true });

const latencyOut = join(outDir, `${prefix}-latency-burst.json`);
const httpsOut = join(outDir, `${prefix}-https.json`);
const suiteResults = [];

suiteResults.push({
	scenario: { profile: 'latency-burst', frontHost: frontHosts },
	...runCommand(buildMatrixCommand(options, {
		profiles: 'latency,burst',
		target: args['http-target'] || 'neverssl.com',
		port: args['http-port'] || 80,
		runs: args.runs || 30,
		out: latencyOut,
	}), dryRun),
});

suiteResults.push({
	scenario: { profile: 'https', frontHost: frontHosts },
	...runCommand(buildMatrixCommand(options, {
		profiles: 'https',
		target: args['https-target'] || 'example.com',
		port: args['https-port'] || 443,
		runs: args['https-runs'] || 10,
		out: httpsOut,
	}), dryRun),
});

if (args['bench-target']) {
	for (const item of [
		{
			profile: 'download',
			httpPath: `/bytes/${args['download-bytes'] || 1048576}`,
			httpMethod: '',
			bodyBytes: '',
		},
		{
			profile: 'upload',
			httpPath: '/sink',
			httpMethod: 'POST',
			bodyBytes: args['upload-bytes'] || 1048576,
		},
	]) {
		const result = runCommand(buildLiveCommand(options, {
			profile: item.profile,
			target: args['bench-target'],
			port: args['bench-port'] || 80,
			httpPath: item.httpPath,
			httpMethod: item.httpMethod,
			bodyBytes: item.bodyBytes,
			runs: args['throughput-runs'] || 10,
		}), dryRun);
		suiteResults.push({
			scenario: { profile: item.profile, frontHost: primaryFrontHost },
			...result,
		});
	}
}

const suiteReport = {
	generatedAt: new Date().toISOString(),
	dryRun,
	primaryFrontHost,
	scenarios: suiteResults,
	reportFiles: dryRun ? [] : [latencyOut, httpsOut],
};
if (!dryRun) writeFileSync(join(outDir, `${prefix}-suite.json`), JSON.stringify(suiteReport, null, 2));
console.log(JSON.stringify({ type: 'suite-summary', dryRun, scenarios: suiteResults.length, reportFiles: suiteReport.reportFiles }, null, 2));

if (suiteResults.some(result => !result.dryRun && (result.exitCode !== 0 || !result.summary) && !result.command.includes('live-benchmark-matrix.mjs'))) process.exit(1);
