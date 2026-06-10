import { readFileSync } from 'node:fs';

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
		'  node scripts/compare-benchmark-reports.mjs --baseline before.json --candidate after.json',
		'',
		'Options:',
		'  --json                       Emit machine-readable JSON only',
		'  --max-latency-regression 10   Allowed p95 latency regression percent',
		'  --max-throughput-regression 5 Allowed throughput regression percent',
	].join('\n'));
}

function readJsonFile(file) {
	return JSON.parse(readFileSync(file, 'utf8'));
}

function numberOrNull(value) {
	return Number.isFinite(value) ? Number(value) : null;
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
		key: [
			scenario.profile || item.profile || 'unknown',
			summary.transport || 'unknown',
			scenario.frontHost || item.frontHost || '',
		].join('|'),
		profile: scenario.profile || item.profile || 'unknown',
		transport: summary.transport || 'unknown',
		frontHost: scenario.frontHost || item.frontHost || '',
		runs: Number(summary.runs || 0),
		acceptRate: Number(summary.acceptRate || 0),
		successRate: Number(summary.successRate || 0),
		tlsP95Ms: numberOrNull(summary.tlsP95Ms),
		firstByteP95Ms: numberOrNull(summary.firstByteP95Ms),
		totalP95Ms: numberOrNull(summary.totalP95Ms),
		throughputP50Mbps: numberOrNull(summary.throughputP50Mbps),
		raw: summary,
	}));
}

function collectEntries(report, sourceFile) {
	if (Array.isArray(report.scenarios)) return report.scenarios.flatMap(item => normalizeSummaryEntry(item, sourceFile));
	if (Array.isArray(report.summary)) return normalizeSummaryEntry(report, sourceFile);
	if (report.type === 'summary' && Array.isArray(report.summary)) return normalizeSummaryEntry(report, sourceFile);
	return [];
}

function percentDelta(before, after, lowerIsBetter = false) {
	if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) return null;
	const delta = ((after - before) / before) * 100;
	return lowerIsBetter ? -delta : delta;
}

function compareEntry(baseline, candidate, options) {
	const changes = {
		acceptRateDelta: candidate.acceptRate - baseline.acceptRate,
		successRateDelta: candidate.successRate - baseline.successRate,
		tlsP95DeltaPct: percentDelta(baseline.tlsP95Ms, candidate.tlsP95Ms, true),
		firstByteP95DeltaPct: percentDelta(baseline.firstByteP95Ms, candidate.firstByteP95Ms, true),
		totalP95DeltaPct: percentDelta(baseline.totalP95Ms, candidate.totalP95Ms, true),
		throughputP50DeltaPct: percentDelta(baseline.throughputP50Mbps, candidate.throughputP50Mbps, false),
	};
	const signals = [];
	if (candidate.acceptRate < baseline.acceptRate) signals.push({ level: 'fail', message: `acceptRate dropped from ${baseline.acceptRate} to ${candidate.acceptRate}` });
	if (candidate.successRate < baseline.successRate) signals.push({ level: 'fail', message: `successRate dropped from ${baseline.successRate} to ${candidate.successRate}` });
	if (changes.tlsP95DeltaPct !== null && changes.tlsP95DeltaPct < -options.maxLatencyRegressionPct) {
		signals.push({ level: 'fail', message: `tlsP95 regressed ${Math.abs(changes.tlsP95DeltaPct).toFixed(1)}%` });
	}
	if (changes.firstByteP95DeltaPct !== null && changes.firstByteP95DeltaPct < -options.maxLatencyRegressionPct) {
		signals.push({ level: 'fail', message: `firstByteP95 regressed ${Math.abs(changes.firstByteP95DeltaPct).toFixed(1)}%` });
	}
	if (changes.totalP95DeltaPct !== null && changes.totalP95DeltaPct < -options.maxLatencyRegressionPct) {
		signals.push({ level: 'fail', message: `totalP95 regressed ${Math.abs(changes.totalP95DeltaPct).toFixed(1)}%` });
	}
	if (changes.throughputP50DeltaPct !== null && changes.throughputP50DeltaPct < -options.maxThroughputRegressionPct) {
		signals.push({ level: 'fail', message: `throughputP50 regressed ${Math.abs(changes.throughputP50DeltaPct).toFixed(1)}%` });
	}
	if (!signals.length) {
		const improved = [
			changes.tlsP95DeltaPct,
			changes.firstByteP95DeltaPct,
			changes.totalP95DeltaPct,
			changes.throughputP50DeltaPct,
		].some(value => value !== null && value > 0);
		signals.push({ level: improved ? 'pass' : 'neutral', message: improved ? 'candidate improves at least one tracked metric without regressions' : 'candidate is statistically similar by configured thresholds' });
	}
	return {
		key: baseline.key,
		profile: baseline.profile,
		transport: baseline.transport,
		frontHost: baseline.frontHost,
		baseline,
		candidate,
		changes,
		signals,
	};
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
	usage();
	process.exit(0);
}
if (!args.baseline || !args.candidate) {
	usage();
	process.exit(2);
}

const options = {
	maxLatencyRegressionPct: Math.max(0, Number(args['max-latency-regression'] || 10)),
	maxThroughputRegressionPct: Math.max(0, Number(args['max-throughput-regression'] || 5)),
};

const baselineEntries = collectEntries(readJsonFile(args.baseline), args.baseline);
const candidateEntries = collectEntries(readJsonFile(args.candidate), args.candidate);
const candidateByKey = new Map(candidateEntries.map(entry => [entry.key, entry]));
const comparisons = [];
const missing = [];
for (const baseline of baselineEntries) {
	const candidate = candidateByKey.get(baseline.key);
	if (!candidate) {
		missing.push(baseline.key);
		continue;
	}
	comparisons.push(compareEntry(baseline, candidate, options));
}

const failures = comparisons.flatMap(comparison => comparison.signals.filter(signal => signal.level === 'fail').map(signal => ({ key: comparison.key, ...signal })));
const report = {
	generatedAt: new Date().toISOString(),
	options,
	baseline: args.baseline,
	candidate: args.candidate,
	compared: comparisons.length,
	missing,
	failures,
	comparisons,
	verdict: failures.length || missing.length ? 'fail' : 'pass',
};

if (args.json) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`Compared ${comparisons.length} matching benchmark scenario(s). Verdict: ${report.verdict.toUpperCase()}`);
	if (missing.length) {
		console.log('\nMissing candidate scenarios:');
		for (const key of missing) console.log(`- ${key}`);
	}
	for (const comparison of comparisons) {
		const label = `${comparison.profile}/${comparison.transport}/${comparison.frontHost || '(none)'}`;
		const tls = comparison.changes.tlsP95DeltaPct;
		const first = comparison.changes.firstByteP95DeltaPct;
		const total = comparison.changes.totalP95DeltaPct;
		const throughput = comparison.changes.throughputP50DeltaPct;
		console.log(`\n${label}`);
		console.log(`  acceptRate: ${comparison.baseline.acceptRate} -> ${comparison.candidate.acceptRate}`);
		console.log(`  successRate: ${comparison.baseline.successRate} -> ${comparison.candidate.successRate}`);
		console.log(`  tlsP95: ${comparison.baseline.tlsP95Ms ?? 'n/a'}ms -> ${comparison.candidate.tlsP95Ms ?? 'n/a'}ms (${tls === null ? 'n/a' : tls.toFixed(1) + '%'})`);
		console.log(`  firstByteP95: ${comparison.baseline.firstByteP95Ms ?? 'n/a'}ms -> ${comparison.candidate.firstByteP95Ms ?? 'n/a'}ms (${first === null ? 'n/a' : first.toFixed(1) + '%'})`);
		console.log(`  totalP95: ${comparison.baseline.totalP95Ms ?? 'n/a'}ms -> ${comparison.candidate.totalP95Ms ?? 'n/a'}ms (${total === null ? 'n/a' : total.toFixed(1) + '%'})`);
		console.log(`  throughputP50: ${comparison.baseline.throughputP50Mbps ?? 'n/a'}Mbps -> ${comparison.candidate.throughputP50Mbps ?? 'n/a'}Mbps (${throughput === null ? 'n/a' : throughput.toFixed(1) + '%'})`);
		for (const signal of comparison.signals) console.log(`  ${signal.level.toUpperCase()}: ${signal.message}`);
	}
}

if (report.verdict !== 'pass') process.exit(1);
