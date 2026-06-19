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
		'  node scripts/plan-tuning-candidates.mjs benchmark-runs/baseline-tuning.json',
		'',
		'Options:',
		'  --json                         Emit machine-readable JSON only',
		'  --out plan.json                 Save the candidate plan JSON',
		'  --baseline-prefix baseline      Baseline report prefix',
		'  --candidate-prefix candidate    Candidate report prefix prefix',
		'  --url https://worker.example/   Worker/custom domain URL for command templates',
		'  --uuid UUID                     VLESS UUID for command templates',
		'  --front-hosts a,b               Front hosts for command templates',
		'  --transports grpc               Limit planning to these transports and use them in command templates',
		'  --sni domain                    TLS SNI for command templates',
		'  --authority domain              gRPC authority for command templates',
		'  --bench-target domain           Optional deterministic benchmark target',
		'',
		'The planner creates safe one variable candidate experiments from a tuning report.',
	].join('\n'));
}

function readJsonFile(file) {
	return JSON.parse(readFileSync(file, 'utf8'));
}

function toNumber(value) {
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function csvSet(value) {
	const items = String(value || '')
		.split(',')
		.map(item => item.trim())
		.filter(Boolean);
	return items.length ? new Set(items) : null;
}

function isReliableEntry(entry) {
	return Number(entry.acceptRate) >= 1 && Number(entry.successRate) >= 1;
}

function makeEntryMatcher(args) {
	const transports = csvSet(args.transports);
	const frontHosts = csvSet(args['front-hosts']);
	return entry => {
		if (!entry) return false;
		if (transports && !transports.has(String(entry.transport || ''))) return false;
		if (frontHosts && entry.frontHost && !frontHosts.has(String(entry.frontHost))) return false;
		return true;
	};
}

function scopedReport(report, args) {
	const matchesEntry = makeEntryMatcher(args);
	const ranked = (report.ranked || []).filter(matchesEntry);
	const bestByProfile = (report.bestByProfile || []).flatMap(group => {
		if (args.transports && !csvSet(args.transports).has(String(group.transport || ''))) return [];
		const sourceCandidates = Array.isArray(group.candidates) && group.candidates.length
			? group.candidates
			: [group.best].filter(Boolean);
		const candidates = sourceCandidates
			.map(candidate => ({ profile: group.profile, transport: group.transport, ...candidate }))
			.filter(matchesEntry);
		if (!candidates.length) return [];
		const reliableCandidates = candidates.filter(isReliableEntry);
		return [{
			...group,
			candidates,
			reliableCandidates,
			best: reliableCandidates[0] || candidates[0],
			reliableBest: reliableCandidates[0] || null,
		}];
	});
	return { ...report, ranked, bestByProfile };
}

function bestFor(report, profile) {
	return (report.bestByProfile || []).find(item => item.profile === profile)?.best || null;
}

function hasReliabilityBlocker(report) {
	if ((report.ranked || []).length) return (report.ranked || []).some(item => Number(item.acceptRate) < 1 || Number(item.successRate) < 1);
	return (report.recommendations || []).some(item => item.category === 'reliability' && ['critical', 'high'].includes(item.priority));
}

function hasDataQualityBlocker(report) {
	return (report.recommendations || []).some(item => item.category === 'data-quality' && ['critical', 'high'].includes(item.priority));
}

function missingCoreProfiles(report) {
	const profiles = new Set([
		...(report.bestByProfile || []).map(item => item.profile),
		...(report.ranked || []).map(item => item.profile),
	].filter(Boolean));
	return ['latency', 'burst', 'https'].filter(profile => !profiles.has(profile));
}

function makeSuiteCommand(args, prefix, label) {
	const parts = [
		'npm run bench:suite --',
		'--url', args.url || 'https://YOUR-WORKER-DOMAIN/',
		'--uuid', args.uuid || 'YOUR-UUID',
		'--front-hosts', args['front-hosts'] || 'front1.example,front2.example',
		'--transports', args.transports || 'grpc',
		'--sni', args.sni || 'YOUR-WORKER-DOMAIN',
		'--authority', args.authority || 'YOUR-WORKER-DOMAIN',
		'--service-name', args['service-name'] || '/',
		'--prefix', prefix,
		'--label', label,
	];
	if (args['bench-target']) parts.push('--bench-target', args['bench-target']);
	return parts.join(' ');
}

function addCandidate(candidates, args, baselinePrefix, candidatePrefix, suffix, env, reason, keepIf) {
	const prefix = `${candidatePrefix}-${suffix}`;
	const envText = Object.entries(env).map(([key, value]) => `${key}=${value}`).join(', ');
	candidates.push({
		id: suffix,
		label: prefix,
		env,
		reason,
		keepIf,
		applyInstruction: `Set Worker variable ${envText}, rebuild/redeploy the Worker, then run the benchmark command.`,
		runCommand: makeSuiteCommand(args, prefix, prefix),
		compareCommand: `npm run bench:compare -- --baseline benchmark-runs/${baselinePrefix}-suite.json --candidate benchmark-runs/${prefix}-suite.json`,
		tuneCommand: `npm run bench:tune -- benchmark-runs/${prefix}-suite.json benchmark-runs/${prefix}-latency-burst.json benchmark-runs/${prefix}-https.json benchmark-runs/${prefix}-download.json benchmark-runs/${prefix}-upload.json --out benchmark-runs/${prefix}-tuning.json`,
	});
}

function makePlan(report, args) {
	report = scopedReport(report, args);
	const baselinePrefix = args['baseline-prefix'] || 'baseline';
	const candidatePrefix = args['candidate-prefix'] || 'candidate';
	const blockers = [];
	if (hasReliabilityBlocker(report)) {
		blockers.push('Reliability is below 100% or the tuning report contains a critical/high reliability warning. Choose better front hosts/IPs before tuning speed variables.');
	}
	if (hasDataQualityBlocker(report)) {
		blockers.push('Benchmark sample quality is too weak. Re-run the baseline with enough samples before creating speed-tuning candidates.');
	}
	const missingProfiles = missingCoreProfiles(report);
	if (missingProfiles.length) {
		blockers.push(`Core benchmark coverage is incomplete: missing ${missingProfiles.join(', ')}. Run the full baseline suite before tuning Worker variables.`);
	}

	const candidates = [];
	if (!blockers.length) {
		const latency = bestFor(report, 'latency');
		const burst = bestFor(report, 'burst');
		const https = bestFor(report, 'https');
		const download = bestFor(report, 'download');
		const upload = bestFor(report, 'upload');
		const latencyP95 = Math.max(toNumber(latency?.firstByteP95Ms) || 0, toNumber(burst?.firstByteP95Ms) || 0, toNumber(https?.firstByteP95Ms) || 0);
		const throughput = Math.max(toNumber(download?.throughputP50Mbps) || 0, toNumber(upload?.throughputP50Mbps) || 0);

		if (latencyP95 > 1000) {
			addCandidate(
				candidates,
				args,
				baselinePrefix,
				candidatePrefix,
				'connect-timeout-700',
				{ CONNECT_TIMEOUT_MS: '700' },
				`Best latency/burst/HTTPS first-byte p95 is ${latencyP95}ms. Test faster bad-path failover.`,
				'Keep only if suite compare passes and firstByteP95 improves without acceptRate/successRate loss.'
			);
		}
		addCandidate(
			candidates,
			args,
			baselinePrefix,
			candidatePrefix,
			'dial-stagger-0',
			{ DIAL_STAGGER_MS: '0' },
			'Race dial candidates immediately. This can improve first-open latency when candidate count is small.',
			'Keep only if firstByteP95 improves and Cloudflare/socket pressure remains acceptable.'
		);
		if (throughput > 0 && throughput < 5) {
			addCandidate(
				candidates,
				args,
				baselinePrefix,
				candidatePrefix,
				'downlink-hwm-512k',
				{ DOWNLINK_BACKPRESSURE_HWM_BYTES: '524288' },
				`Best measured throughput p50 is ${throughput}Mbps. Test a larger downstream buffer for video/download.`,
				'Keep only if throughputP50 improves without p95 latency regression.'
			);
			addCandidate(
				candidates,
				args,
				baselinePrefix,
				candidatePrefix,
				'downlink-grain-64k',
				{ DOWNLINK_GRAIN_PACKET_BYTES: '65536' },
				'Test larger downstream flush grain for smoother sustained downloads and video buffering.',
				'Keep only if download/video throughput improves without slower small-page opens.'
			);
		}
		if (toNumber(upload?.throughputP50Mbps) !== null && toNumber(upload?.throughputP50Mbps) < 5) {
			addCandidate(
				candidates,
				args,
				baselinePrefix,
				candidatePrefix,
				'uplink-bundle-32k',
				{ UPLINK_BUNDLE_TARGET_BYTES: '32768' },
				'Upload p50 is low. Test larger uplink bundling to reduce write overhead.',
				'Keep only if upload throughput improves without hurting burst latency.'
			);
		}
	}

	return {
		generatedAt: new Date().toISOString(),
		source: args.files[0],
		blocked: blockers.length > 0,
		blockers,
		candidates,
		rules: [
			'Change one variable per candidate.',
			'Run at the same time of day and on the same network as baseline.',
			'Keep a candidate only when bench:compare passes and bench:tune adds no new critical/high reliability warning.',
		],
	};
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
	usage();
	process.exit(0);
}
if (args.files.length !== 1) {
	usage();
	process.exit(2);
}

const report = makePlan(readJsonFile(args.files[0]), args);
if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2));

if (args.json) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`Tuning candidate plan: ${report.blocked ? 'blocked' : `${report.candidates.length} candidate(s)`}`);
	for (const blocker of report.blockers) console.log(`BLOCKER: ${blocker}`);
	for (const candidate of report.candidates) {
		console.log(`\n${candidate.label}`);
		console.log(`  Env: ${Object.entries(candidate.env).map(([key, value]) => `${key}=${value}`).join(' ')}`);
		console.log(`  Reason: ${candidate.reason}`);
		console.log(`  Apply: ${candidate.applyInstruction}`);
		console.log(`  Run: ${candidate.runCommand}`);
		console.log(`  Compare: ${candidate.compareCommand}`);
	}
}
