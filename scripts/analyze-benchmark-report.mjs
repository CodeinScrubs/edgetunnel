import { readFileSync } from 'node:fs';

function parseArgs(argv) {
	const out = { files: [] };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith('--')) {
			out.files.push(arg);
			continue;
		}
		const key = arg.slice(2);
		const next = argv[i + 1];
		out[key] = next && !next.startsWith('--') ? argv[++i] : '1';
	}
	return out;
}

function usage() {
	console.error([
		'Usage:',
		'  node scripts/analyze-benchmark-report.mjs benchmark-baseline.json',
		'',
		'Options:',
		'  --json       Emit machine-readable JSON only',
		'  --min-runs 5 Minimum runs before a scenario is considered tune-worthy',
	].join('\n'));
}

function readJsonFile(file) {
	return JSON.parse(readFileSync(file, 'utf8'));
}

function scenarioLabel(item) {
	const scenario = item.scenario || {};
	const frontHost = scenario.frontHost || item.frontHost || '(none)';
	const profile = scenario.profile || item.profile || 'unknown';
	const transport = item.transport || item.summary?.transport || item.summary?.summary?.[0]?.transport || 'unknown';
	return `${profile}/${transport}/${frontHost}`;
}

function normalizeSummaryEntry(item, sourceFile) {
	const scenario = item.scenario || {};
	const summaryArray = Array.isArray(item.summary?.summary)
		? item.summary.summary
		: Array.isArray(item.summary)
			? item.summary
			: [];
	return summaryArray.map(summary => ({
		sourceFile,
		scenario,
		label: scenarioLabel({ ...item, summary }),
		transport: summary.transport || 'unknown',
		profile: scenario.profile || item.profile || 'unknown',
		frontHost: scenario.frontHost || item.frontHost || '',
		runs: Number(summary.runs || 0),
		acceptRate: Number(summary.acceptRate || 0),
		successRate: Number(summary.successRate || 0),
		firstByteP50Ms: numberOrNull(summary.firstByteP50Ms),
		firstByteP95Ms: numberOrNull(summary.firstByteP95Ms),
		totalP50Ms: numberOrNull(summary.totalP50Ms),
		totalP95Ms: numberOrNull(summary.totalP95Ms),
		throughputP50Mbps: numberOrNull(summary.throughputP50Mbps),
		throughputP95Mbps: numberOrNull(summary.throughputP95Mbps),
		raw: summary,
	}));
}

function numberOrNull(value) {
	return Number.isFinite(value) ? Number(value) : null;
}

function collectEntries(report, sourceFile) {
	if (Array.isArray(report.scenarios)) {
		return report.scenarios.flatMap(item => normalizeSummaryEntry(item, sourceFile));
	}
	if (Array.isArray(report.summary)) {
		return normalizeSummaryEntry(report, sourceFile);
	}
	if (report.type === 'summary' && Array.isArray(report.summary)) {
		return normalizeSummaryEntry(report, sourceFile);
	}
	return [];
}

function score(entry) {
	return {
		successRate: entry.successRate,
		acceptRate: entry.acceptRate,
		firstByteP95Ms: entry.firstByteP95Ms ?? Infinity,
		totalP95Ms: entry.totalP95Ms ?? Infinity,
		throughputP50Mbps: entry.throughputP50Mbps ?? 0,
	};
}

function compareEntries(a, b) {
	const left = score(a);
	const right = score(b);
	return right.successRate - left.successRate
		|| right.acceptRate - left.acceptRate
		|| left.firstByteP95Ms - right.firstByteP95Ms
		|| left.totalP95Ms - right.totalP95Ms
		|| right.throughputP50Mbps - left.throughputP50Mbps;
}

function makeSignals(entries, minRuns) {
	const signals = [];
	for (const entry of entries) {
		if (entry.runs < minRuns) signals.push({ level: 'warn', label: entry.label, message: `Only ${entry.runs} runs; use at least ${minRuns} before tuning.` });
		if (entry.acceptRate < 1) signals.push({ level: 'fail', label: entry.label, message: `Tunnel accept rate is ${entry.acceptRate}; fix reliability before speed tuning.` });
		if (entry.successRate < 1) signals.push({ level: 'fail', label: entry.label, message: `Inner success rate is ${entry.successRate}; target/front/transport is not stable enough.` });
		if ((entry.firstByteP95Ms ?? 0) > 1000) signals.push({ level: 'warn', label: entry.label, message: `First-byte p95 is ${entry.firstByteP95Ms}ms; users may feel stalls on browsing or Telegram bursts.` });
		if ((entry.totalP95Ms ?? 0) > 3000 && ['latency', 'burst'].includes(entry.profile)) signals.push({ level: 'warn', label: entry.label, message: `Small-response total p95 is ${entry.totalP95Ms}ms; front host or path is jittery.` });
		if (['download', 'upload'].includes(entry.profile) && entry.throughputP50Mbps !== null && entry.throughputP50Mbps < 5) {
			signals.push({ level: 'warn', label: entry.label, message: `Throughput p50 is ${entry.throughputP50Mbps} Mbps; test bigger payloads and alternate fronts before tuning buffers.` });
		}
	}
	return signals;
}

function groupBestByProfile(entries) {
	const groups = new Map();
	for (const entry of entries) {
		const key = `${entry.profile}/${entry.transport}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(entry);
	}
	return [...groups.entries()].map(([key, group]) => ({
		key,
		best: [...group].sort(compareEntries)[0],
		candidates: [...group].sort(compareEntries),
	}));
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
	usage();
	process.exit(0);
}
if (args.files.length === 0) {
	usage();
	process.exit(2);
}

const minRuns = Math.max(1, Math.round(Number(args['min-runs'] || 5)));
const entries = args.files.flatMap(file => collectEntries(readJsonFile(file), file));
const ranked = [...entries].sort(compareEntries).map((entry, index) => ({ rank: index + 1, ...entry }));
const bestByProfile = groupBestByProfile(entries);
const signals = makeSignals(entries, minRuns);
const report = {
	generatedAt: new Date().toISOString(),
	minRuns,
	files: args.files,
	scenarios: entries.length,
	ranked,
	bestByProfile,
	signals,
};

if (args.json) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`Analyzed ${entries.length} benchmark scenarios from ${args.files.length} file(s).`);
	for (const group of bestByProfile) {
		const best = group.best;
		console.log(`Best ${group.key}: ${best.frontHost || '(none)'} success=${best.successRate} accept=${best.acceptRate} p95=${best.firstByteP95Ms ?? 'n/a'}ms totalP95=${best.totalP95Ms ?? 'n/a'}ms throughput=${best.throughputP50Mbps ?? 'n/a'}Mbps`);
	}
	if (signals.length) {
		console.log('\nSignals:');
		for (const signal of signals) console.log(`- ${signal.level.toUpperCase()} ${signal.label}: ${signal.message}`);
	} else {
		console.log('\nSignals: none. Data is clean enough for a controlled A/B tuning run.');
	}
}

if (entries.length === 0) process.exit(1);
