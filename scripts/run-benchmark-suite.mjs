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
		'  --label baseline          Human label stored in the suite report',
		'  --front-hosts a,b         Clean/front hosts to compare',
		'  --transports grpc         grpc, ws, xhttp, all, or comma-separated list for latency/burst/download/upload',
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
			if (parsed?.type === 'matrix-summary' && Array.isArray(parsed.ranked)) return parsed;
		} catch {}
	}
	return null;
}

function buildMatrixCommand(options, { profiles, target, port, runs, out, httpPath, httpMethod, bodyBytes, timeout }) {
	const commandArgs = ['scripts/live-benchmark-matrix.mjs'];
	for (const name of ['url', 'uuid', 'sni', 'authority']) addFlag(commandArgs, name, options[name]);
	addFlag(commandArgs, 'transports', profiles === 'https' ? 'grpc' : options.transports);
	addFlag(commandArgs, 'front-hosts', options['front-hosts']);
	addFlag(commandArgs, 'profiles', profiles);
	addFlag(commandArgs, 'runs', runs);
	addFlag(commandArgs, 'service-name', options['service-name']);
	addFlag(commandArgs, 'target', target);
	addFlag(commandArgs, 'port', port);
	addFlag(commandArgs, 'http-path', httpPath);
	addFlag(commandArgs, 'http-method', httpMethod);
	addFlag(commandArgs, 'body-bytes', bodyBytes);
	addFlag(commandArgs, 'timeout', timeout);
	addFlag(commandArgs, 'out', out);
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
const label = args.label || prefix;
const frontHosts = args['front-hosts'] || 'sourceforge.net,www.modrinth.com';
const primaryFrontHost = frontHosts.split(',').map(item => item.trim()).filter(Boolean)[0] || '';
const options = {
	...args,
	url,
	uuid,
	'front-hosts': frontHosts,
	primaryFrontHost,
	transports: args.transports || process.env.TUNNEL_BENCH_TRANSPORTS || 'grpc',
	'service-name': args['service-name'] || '/',
};
if (!dryRun) mkdirSync(outDir, { recursive: true });

const latencyOut = join(outDir, `${prefix}-latency-burst.json`);
const httpsOut = join(outDir, `${prefix}-https.json`);
const throughputReportFiles = [];
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
	scenario: { profile: 'https', frontHost: frontHosts, transportNote: 'grpc-only' },
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
			out: join(outDir, `${prefix}-download.json`),
			httpPath: `/bytes/${args['download-bytes'] || 1048576}`,
			httpMethod: '',
			bodyBytes: '',
		},
		{
			profile: 'upload',
			out: join(outDir, `${prefix}-upload.json`),
			httpPath: '/sink',
			httpMethod: 'POST',
			bodyBytes: args['upload-bytes'] || 1048576,
		},
	]) {
		throughputReportFiles.push(item.out);
		const result = runCommand(buildMatrixCommand(options, {
			profiles: item.profile,
			target: args['bench-target'],
			port: args['bench-port'] || 80,
			httpPath: item.httpPath,
			httpMethod: item.httpMethod,
			bodyBytes: item.bodyBytes,
			runs: args['throughput-runs'] || 10,
			timeout: 30000,
			out: item.out,
		}), dryRun);
		suiteResults.push({
			scenario: { profile: item.profile, frontHost: frontHosts },
			...result,
		});
	}
}

const suiteReport = {
	generatedAt: new Date().toISOString(),
	label,
	prefix,
	dryRun,
	primaryFrontHost,
	frontHosts: frontHosts.split(',').map(item => item.trim()).filter(Boolean),
	transports: options.transports,
	httpsTransportNote: 'HTTPS suite uses the gRPC inner-TLS benchmark; latency/burst/download/upload honor --transports.',
	targets: {
		http: args['http-target'] || 'neverssl.com',
		https: args['https-target'] || 'example.com',
		benchmark: args['bench-target'] || null,
	},
	scenarios: suiteResults,
	reportFiles: dryRun ? [] : [latencyOut, httpsOut, ...throughputReportFiles],
};
if (!dryRun) writeFileSync(join(outDir, `${prefix}-suite.json`), JSON.stringify(suiteReport, null, 2));
console.log(JSON.stringify({ type: 'suite-summary', dryRun, scenarios: suiteResults.length, reportFiles: suiteReport.reportFiles }, null, 2));

if (suiteResults.some(result => !result.dryRun && (result.exitCode !== 0 || !result.summary))) process.exit(1);
