import { readFileSync, writeFileSync } from 'node:fs';

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
		'  node scripts/benchmark-tuning-report.mjs benchmark-runs/baseline-suite.json benchmark-runs/baseline-latency-burst.json',
		'',
		'Options:',
		'  --json          Emit machine-readable JSON only',
		'  --out report.json Save the full tuning report JSON',
		'  --min-runs 10   Minimum runs before recommendations trust a scenario',
		'',
		'The report converts raw benchmark metrics into recommendations for reliability, latency, throughput, HTTPS browsing, and data-quality gaps.',
	].join('\n'));
}

function readJsonFile(file) {
	return JSON.parse(readFileSync(file, 'utf8'));
}

function numberOrNull(value) {
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function isMatrixCommand(item) {
	return String(item.command || '').includes('live-benchmark-matrix.mjs');
}

function isWrapperAggregateScenario(item) {
	return isMatrixCommand(item)
		&& item.summary?.type === 'summary'
		&& String(item.scenario?.frontHost || '').includes(',');
}

function normalizeSummaryArray(summaryArray, scenario, item, sourceFile, reportMeta = {}) {
	return summaryArray.map(summary => ({
		sourceFile,
		reportLabel: reportMeta.label || reportMeta.prefix || '',
		profile: scenario.profile || item.profile || summary.profile || 'unknown',
		transport: summary.transport || item.transport || 'unknown',
		frontHost: scenario.frontHost || item.frontHost || '',
		runs: Number(summary.runs || 0),
		acceptRate: Number(summary.acceptRate || 0),
		successRate: Number(summary.successRate || 0),
		tlsP50Ms: numberOrNull(summary.tlsP50Ms),
		tlsP95Ms: numberOrNull(summary.tlsP95Ms),
		tlsJitterMs: numberOrNull(summary.tlsJitterMs),
		firstByteP50Ms: numberOrNull(summary.firstByteP50Ms),
		firstByteP95Ms: numberOrNull(summary.firstByteP95Ms),
		firstByteJitterMs: numberOrNull(summary.firstByteJitterMs),
		totalP50Ms: numberOrNull(summary.totalP50Ms),
		totalP95Ms: numberOrNull(summary.totalP95Ms),
		totalJitterMs: numberOrNull(summary.totalJitterMs),
		throughputP50Mbps: numberOrNull(summary.throughputP50Mbps),
		throughputP95Mbps: numberOrNull(summary.throughputP95Mbps),
		raw: summary,
	}));
}

function normalizeSummaryEntry(item, sourceFile, reportMeta = {}) {
	if (isWrapperAggregateScenario(item)) return [];
	if (item.summary?.type === 'matrix-summary' && Array.isArray(item.summary.ranked)) {
		return item.summary.ranked.flatMap(rankedItem => normalizeSummaryArray(
			Array.isArray(rankedItem.summary) ? rankedItem.summary : [],
			rankedItem.scenario || item.scenario || {},
			item,
			sourceFile,
			reportMeta
		));
	}
	const scenario = item.scenario || {};
	const summaryArray = Array.isArray(item.summary?.summary)
		? item.summary.summary
		: Array.isArray(item.summary)
			? item.summary
			: [];
	return normalizeSummaryArray(summaryArray, scenario, item, sourceFile, reportMeta);
}

function collectEntries(report, sourceFile) {
	const meta = {
		label: report.label || report.configLabel || '',
		prefix: report.prefix || '',
	};
	if (Array.isArray(report.scenarios)) {
		return report.scenarios.flatMap(item => normalizeSummaryEntry(item, sourceFile, meta));
	}
	if (Array.isArray(report.summary)) {
		return normalizeSummaryEntry(report, sourceFile, meta);
	}
	if (report.type === 'summary' && Array.isArray(report.summary)) {
		return normalizeSummaryEntry(report, sourceFile, meta);
	}
	return [];
}

function score(entry) {
	return {
		successRate: entry.successRate,
		acceptRate: entry.acceptRate,
		tlsP95Ms: entry.tlsP95Ms ?? Infinity,
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
		|| left.tlsP95Ms - right.tlsP95Ms
		|| left.firstByteP95Ms - right.firstByteP95Ms
		|| left.totalP95Ms - right.totalP95Ms
		|| right.throughputP50Mbps - left.throughputP50Mbps;
}

function entryLabel(entry) {
	return `${entry.profile}/${entry.transport}/${entry.frontHost || '(none)'}`;
}

function isReliableEntry(entry) {
	return entry.acceptRate >= 1 && entry.successRate >= 1;
}

function groupBestByProfile(entries) {
	const groups = new Map();
	for (const entry of entries) {
		const key = `${entry.profile}|${entry.transport}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(entry);
	}
	return [...groups.entries()].map(([key, group]) => {
		const [profile, transport] = key.split('|');
		const candidates = [...group].sort(compareEntries);
		const reliableCandidates = candidates.filter(isReliableEntry);
		return {
			profile,
			transport,
			best: reliableCandidates[0] || candidates[0],
			reliableBest: reliableCandidates[0] || null,
			reliableCandidates,
			candidates,
		};
	}).sort((a, b) => a.profile.localeCompare(b.profile) || a.transport.localeCompare(b.transport));
}

function addRecommendation(recommendations, category, priority, title, evidence, action) {
	recommendations.push({ category, priority, title, evidence, action });
}

function makeRecommendations(entries, bestByProfile, minRuns) {
	const recommendations = [];
	const byProfile = new Map(bestByProfile.map(group => [group.profile, group]));
	const nonHttpsTransports = new Set(entries
		.filter(entry => entry.profile !== 'https')
		.map(entry => entry.transport)
		.filter(Boolean));
	const httpsTransports = new Set(entries
		.filter(entry => entry.profile === 'https')
		.map(entry => entry.transport)
		.filter(Boolean));
	for (const entry of entries) {
		if (entry.runs < minRuns) {
			addRecommendation(
				recommendations,
				'data-quality',
				'high',
				`Collect more samples for ${entryLabel(entry)}`,
				`Only ${entry.runs} runs were captured; minimum is ${minRuns}.`,
				'Do not tune source defaults from this scenario yet. Re-run with more samples at the same time of day.'
			);
		}
		if (entry.acceptRate < 1 || entry.successRate < 1) {
			addRecommendation(
				recommendations,
				'reliability',
				'critical',
				`Fix reliability before speed tuning for ${entryLabel(entry)}`,
				`acceptRate=${entry.acceptRate}, successRate=${entry.successRate}.`,
				'Try alternate front hosts/IPs and keep the transport stable before changing buffer or timeout defaults.'
			);
		}
		if (['latency', 'burst'].includes(entry.profile) && (entry.firstByteP95Ms ?? 0) > 1000) {
			addRecommendation(
				recommendations,
				'latency',
				'high',
				`Reduce first-byte stalls for ${entryLabel(entry)}`,
				`firstByteP95=${entry.firstByteP95Ms}ms.`,
				'Compare front hosts first. If all fronts are slow, test CONNECT_TIMEOUT_MS and DIAL_STAGGER_MS variants one at a time.'
			);
		}
		if (entry.profile === 'https' && ((entry.tlsP95Ms ?? 0) > 1500 || (entry.firstByteP95Ms ?? 0) > 1500)) {
			addRecommendation(
				recommendations,
				'https-browsing',
				'high',
				`Improve real HTTPS open time for ${entryLabel(entry)}`,
				`tlsP95=${entry.tlsP95Ms ?? 'n/a'}ms, firstByteP95=${entry.firstByteP95Ms ?? 'n/a'}ms.`,
				'Favor the front host with the lowest HTTPS/TLS p95, not just the plain HTTP latency result.'
			);
		}
		if (['latency', 'burst', 'https'].includes(entry.profile) && (entry.firstByteJitterMs ?? 0) > 500) {
			addRecommendation(
				recommendations,
				'jitter',
				'high',
				`Reduce latency swings for ${entryLabel(entry)}`,
				`firstByteJitter=${entry.firstByteJitterMs}ms.`,
				'Prefer a front host/transport with lower p95-minus-p50 spread before tuning buffers; this affects random browsing and Telegram-style stalls.'
			);
		}
		if (entry.profile === 'https' && (entry.tlsJitterMs ?? 0) > 500) {
			addRecommendation(
				recommendations,
				'jitter',
				'high',
				`Reduce HTTPS handshake swings for ${entryLabel(entry)}`,
				`tlsJitter=${entry.tlsJitterMs}ms.`,
				'Use the HTTPS profile to choose the front host with steadier TLS opens; do not judge only by plain HTTP latency.'
			);
		}
		if (['download', 'upload'].includes(entry.profile) && entry.throughputP50Mbps !== null && entry.throughputP50Mbps < 5) {
			addRecommendation(
				recommendations,
				'throughput',
				'medium',
				`Throughput is low for ${entryLabel(entry)}`,
				`throughputP50=${entry.throughputP50Mbps}Mbps.`,
				'Run the deterministic benchmark target with 1 MiB, then 4 MiB. Tune DOWNLINK_GRAIN_PACKET_BYTES or backpressure only after front-host choice is stable.'
			);
		}
	}
	for (const group of bestByProfile) {
		if (group.reliableCandidates.length <= 1) continue;
		const best = group.reliableCandidates[0];
		const runnerUp = group.reliableCandidates[1];
		addRecommendation(
			recommendations,
			'front-host',
			'medium',
			`Prefer ${best.frontHost || '(no front host)'} for ${group.profile}/${group.transport}`,
			`Best p95=${best.firstByteP95Ms ?? best.tlsP95Ms ?? best.totalP95Ms ?? 'n/a'}ms vs runner-up ${runnerUp.frontHost || '(none)'}.`,
			'Generate configs with this front host first, but keep one backup from the next-best candidate for failover.'
		);
	}
	if (!byProfile.has('burst')) {
		addRecommendation(
			recommendations,
			'coverage',
			'medium',
			'Add burst benchmarks',
			'No burst profile was found.',
			'Run the suite with latency,burst to model Telegram-style concurrent connection spikes.'
		);
	}
	if (!byProfile.has('https')) {
		addRecommendation(
			recommendations,
			'coverage',
			'medium',
			'Add HTTPS browsing benchmarks',
			'No HTTPS profile was found.',
			'Run the HTTPS benchmark so tuning accounts for inner TLS handshake latency and real browsing feel.'
		);
	}
	const missingHttpsTransports = [...nonHttpsTransports].filter(transport => !httpsTransports.has(transport));
	if (httpsTransports.size && missingHttpsTransports.length) {
		addRecommendation(
			recommendations,
			'coverage',
			'medium',
			`HTTPS real-browsing coverage is missing for ${missingHttpsTransports.join(', ')}`,
			`Measured non-HTTPS transports: ${[...nonHttpsTransports].join(', ')}; HTTPS transports: ${[...httpsTransports].join(', ')}.`,
			'Use latency/burst/download/upload to compare these transports, but do not claim real HTTPS browsing superiority for transports missing HTTPS coverage.'
		);
	}
	return recommendations.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.category.localeCompare(b.category));
}

function priorityRank(priority) {
	return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
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

const minRuns = Math.max(1, Math.round(Number(args['min-runs'] || 10)));
const entries = args.files.flatMap(file => collectEntries(readJsonFile(file), file));
const ranked = [...entries].sort(compareEntries).map((entry, index) => ({ rank: index + 1, ...entry }));
const bestByProfile = groupBestByProfile(entries);
const recommendations = makeRecommendations(entries, bestByProfile, minRuns);
const report = {
	generatedAt: new Date().toISOString(),
	minRuns,
	files: args.files,
	scenarios: entries.length,
	ranked,
	bestByProfile,
	recommendations,
	nextRun: {
		baseline: 'npm run bench:suite -- --url https://YOUR_WORKER/ --uuid YOUR_UUID --front-hosts front1.example,front2.example --sni YOUR_DOMAIN --authority YOUR_DOMAIN --prefix baseline',
		compare: 'npm run bench:compare -- --baseline benchmark-runs/baseline-latency-burst.json --candidate benchmark-runs/candidate-latency-burst.json',
	},
};

if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2));

if (args.json) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`Tuning report: ${entries.length} scenario(s) from ${args.files.length} file(s).`);
	for (const group of bestByProfile) {
		const best = group.best;
		if (!group.reliableBest) {
			console.log(`No reliable ${group.profile}/${group.transport} candidate. Best observed ${best.frontHost || '(none)'} accept=${best.acceptRate} success=${best.successRate}.`);
			continue;
		}
		console.log(`Best ${group.profile}/${group.transport}: ${best.frontHost || '(none)'} accept=${best.acceptRate} success=${best.successRate} tlsP95=${best.tlsP95Ms ?? 'n/a'}ms firstByteP95=${best.firstByteP95Ms ?? 'n/a'}ms throughput=${best.throughputP50Mbps ?? 'n/a'}Mbps`);
	}
	console.log('\nRecommendations:');
	for (const item of recommendations) {
		console.log(`- ${item.priority.toUpperCase()} ${item.category}: ${item.title}`);
		console.log(`  Evidence: ${item.evidence}`);
		console.log(`  Action: ${item.action}`);
	}
}

if (entries.length === 0) process.exit(1);
