import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

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
		'  node scripts/live-benchmark-matrix.mjs --url https://your-domain.example/ --uuid your-vless-uuid --front-hosts sourceforge.net,www.modrinth.com --profiles latency,burst',
		'',
		'Options:',
		'  --front-hosts a,b        Comma-separated gRPC clean/front hosts to compare',
		'  --profiles latency,burst latency, burst, download, upload',
		'  --transports grpc        grpc, ws, xhttp, all, or comma-separated list',
		'  --runs 10               Runs per scenario',
		'  --out report.json       Optional JSON report path',
		'  --dry-run               Print commands without running them',
		'',
		'All other common live benchmark flags are forwarded: --sni, --authority, --service-name, --target, --port, --timeout, --http-path, --http-method, --body-bytes, --concurrency.',
	].join('\n'));
}

function splitList(value, fallback) {
	return String(value || fallback || '')
		.split(',')
		.map(item => item.trim())
		.filter(Boolean);
}

function addFlag(args, name, value) {
	if (value === undefined || value === null || value === '') return;
	args.push(`--${name}`, String(value));
}

function buildScenarioCommand(baseArgs, scenario) {
	const commandArgs = ['scripts/live-tunnel-benchmark.mjs'];
	for (const name of ['url', 'uuid', 'transports', 'sni', 'authority', 'target', 'port', 'timeout', 'ua']) addFlag(commandArgs, name, baseArgs[name]);
	addFlag(commandArgs, 'service-name', baseArgs['service-name']);
	addFlag(commandArgs, 'http-path', baseArgs['http-path']);
	addFlag(commandArgs, 'http-method', baseArgs['http-method']);
	addFlag(commandArgs, 'body-bytes', baseArgs['body-bytes']);
	addFlag(commandArgs, 'concurrency', baseArgs.concurrency);
	addFlag(commandArgs, 'runs', baseArgs.runs);
	addFlag(commandArgs, 'front-host', scenario.frontHost);
	addFlag(commandArgs, 'profile', scenario.profile);
	commandArgs.push('--summary-line');
	return commandArgs;
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

function scoreSummary(summary) {
	const first = summary?.summary?.[0] || {};
	return {
		acceptRate: Number(first.acceptRate || 0),
		successRate: Number(first.successRate || 0),
		firstByteP95Ms: Number.isFinite(first.firstByteP95Ms) ? first.firstByteP95Ms : Infinity,
		totalP95Ms: Number.isFinite(first.totalP95Ms) ? first.totalP95Ms : Infinity,
		throughputP50Mbps: Number.isFinite(first.throughputP50Mbps) ? first.throughputP50Mbps : 0,
	};
}

function compareScenarioResults(a, b) {
	const left = scoreSummary(a.summary);
	const right = scoreSummary(b.summary);
	return right.successRate - left.successRate
		|| right.acceptRate - left.acceptRate
		|| left.firstByteP95Ms - right.firstByteP95Ms
		|| left.totalP95Ms - right.totalP95Ms
		|| right.throughputP50Mbps - left.throughputP50Mbps;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
	usage();
	process.exit(0);
}

const url = args.url || process.env.TUNNEL_BENCH_URL || process.env.GRPC_BENCH_URL;
const uuid = args.uuid || process.env.TUNNEL_BENCH_UUID || process.env.GRPC_BENCH_UUID;
const dryRun = ['1', 'true'].includes(String(args['dry-run'] || '').toLowerCase());
if ((!url || !uuid) && !dryRun) {
	usage();
	process.exit(2);
}

const profiles = splitList(args.profiles || process.env.TUNNEL_BENCH_PROFILES, 'latency,burst');
const frontHosts = splitList(args['front-hosts'] || args.fronts || process.env.TUNNEL_BENCH_FRONT_HOSTS || args['front-host'] || process.env.TUNNEL_BENCH_FRONT_HOST, '');
const scenarioFrontHosts = frontHosts.length ? frontHosts : [''];
const baseArgs = {
	...args,
	url,
	uuid,
	transports: args.transports || process.env.TUNNEL_BENCH_TRANSPORTS || 'grpc',
	runs: args.runs || process.env.TUNNEL_BENCH_RUNS || '10',
};

const scenarios = [];
for (const profile of profiles) {
	for (const frontHost of scenarioFrontHosts) scenarios.push({ profile, frontHost });
}

const results = [];
for (const scenario of scenarios) {
	const commandArgs = buildScenarioCommand(baseArgs, scenario);
	const commandText = `node ${commandArgs.join(' ')}`;
	if (dryRun) {
		console.log(commandText);
		results.push({ scenario, command: commandText, dryRun: true });
		continue;
	}
	console.error(`\n=== ${scenario.profile} ${scenario.frontHost || '(no front host)'} ===`);
	const result = spawnSync(process.execPath, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
	process.stdout.write(result.stdout);
	const summary = parseSummaryLine(result.stdout);
	results.push({
		scenario,
		command: commandText,
		exitCode: result.status,
		summary,
		error: result.error?.message || (summary ? null : 'Missing summary line'),
	});
}

const ranked = [...results]
	.filter(result => result.summary)
	.sort(compareScenarioResults)
	.map((result, index) => ({ rank: index + 1, scenario: result.scenario, summary: result.summary.summary }));

const report = {
	generatedAt: new Date().toISOString(),
	dryRun,
	scenarios: results,
	ranked,
};

if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ type: 'matrix-summary', generatedAt: report.generatedAt, dryRun, scenarios: results.length, ranked }, null, 2));

if (results.some(result => !result.dryRun && (result.exitCode !== 0 || !result.summary))) process.exit(1);
