import { readFileSync } from 'node:fs';

// src_static_ui/worker_test.js is the DEPLOYED artifact: it is the copy-paste data plane plus the inline
// panel, and it is hand-maintained, so `npm run build` never regenerates it and never notices when it
// falls behind src/worker.js.
//
// The previous parity check compared a curated list of 33 named data-plane functions. Such a list is
// structurally blind: it cannot report drift in a function nobody thought to add to it. Exactly that
// happened -- the uplink queue factory kept ignoring its env-configurable caps, and /version kept the old
// lossy Number(...) coercion, in the deployed build for several releases after both were fixed in src.
//
// So compare EVERY top-level function, and let the allowlists below carry the by-design exceptions.
const CANONICAL = '_worker_copypaste.js';
const PANEL = 'src_static_ui/worker_test.js';

// Present in the canonical build only. The panel build serves its admin UI inline, so it has no use for
// the English-static-page fetcher or the runtime HTML translator that the external panel needs.
const PANEL_MAY_OMIT = new Set([
	'escapeRegExp',
	'translateUIText',
	'translateSafeTagAttributes',
	'translateHTMLChunk',
	'translateHTMLVisibleText',
	'unicodeEscapeScriptText',
	'buildEnglishRuntimeTranslatorScript',
	'injectEnglishRuntimeTranslator',
	'normalizeEnglishLoginPage',
	'fetchEnglishStaticPage',
	'normalizeEnglishStaticPageCachePath',
]);

// Deliberate panel variants. Keep this set as small as possible: every name here is a function the gate
// stops protecting, so it must be justified, not merely convenient.
//
// stringifyJSONASCII: the panel build builds its escape backslash via String.fromCharCode(92) rather than
// writing a literal one, so the inline panel's script text survives being embedded in a template literal.
const INTENTIONAL_PANEL_VARIANTS = new Set([
	'stringifyJSONASCII',
]);

// A naive brace counter over raw text over-runs the moment a function contains a brace inside a string, a
// template literal, a regex or a comment -- finalizeSubscriptionContent extracted as 2644 lines that way,
// swallowing the entire rest of the file. Under-running is the more dangerous direction, because it
// reports two genuinely different functions as identical. So skip the literal forms properly.
function scanEndOfBlock(text, openBrace) {
	let depth = 0;
	// One entry per open template literal; the value is the `${ }` nesting depth inside that template,
	// 0 meaning "in template text", >0 meaning "in an interpolation".
	const templates = [];
	let prev = '';
	for (let i = openBrace; i < text.length; i++) {
		const c = text[i], next = text[i + 1];
		const inTemplateText = templates.length > 0 && templates[templates.length - 1] === 0;

		if (inTemplateText) {
			if (c === '\\') { i++; continue; }
			if (c === '`') { templates.pop(); prev = '`'; continue; }
			if (c === '$' && next === '{') { templates[templates.length - 1] = 1; i++; prev = '{'; continue; }
			continue;
		}
		if (c === '/' && next === '/') { const nl = text.indexOf('\n', i); if (nl < 0) return -1; i = nl; continue; }
		if (c === '/' && next === '*') { const e = text.indexOf('*/', i + 2); if (e < 0) return -1; i = e + 1; continue; }
		if (c === '"' || c === "'") {
			let closed = false;
			for (i++; i < text.length; i++) {
				if (text[i] === '\\') { i++; continue; }
				if (text[i] === c) { closed = true; break; }
				if (text[i] === '\n') break; // unterminated -> refuse to guess
			}
			if (!closed) return -1;
			prev = 'x';
			continue;
		}
		if (c === '`') { templates.push(0); continue; }
		if (c === '/' && regexCanStartAfter(text, i, prev)) {
			let inClass = false, closed = false;
			for (i++; i < text.length; i++) {
				if (text[i] === '\\') { i++; continue; }
				if (text[i] === '[') inClass = true;
				else if (text[i] === ']') inClass = false;
				else if (text[i] === '/' && !inClass) { closed = true; break; }
				else if (text[i] === '\n') break;
			}
			if (!closed) return -1;
			prev = 'x';
			continue;
		}
		if (c === '{') { depth++; prev = '{'; continue; }
		if (c === '}') {
			// A `}` that closes an interpolation belongs to the template, not to the function body.
			if (templates.length && templates[templates.length - 1] > 0) {
				templates[templates.length - 1]--;
				prev = '}';
				continue;
			}
			depth--;
			if (depth === 0) return i + 1;
			prev = '}';
			continue;
		}
		if (!/\s/.test(c)) prev = c;
	}
	return -1;
}

// A '/' is a regex only in operand position: division follows a value, a regex follows an operator, an
// opening punctuator, or one of these keywords.
const REGEX_PRECEDING_KEYWORD = /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await|throw)\s*$/;
function regexCanStartAfter(text, index, prev) {
	if (prev === '') return true;
	if ('(,=:[!&|?{};+-*%~^<>'.includes(prev)) return true;
	// `prev` is collapsed to a single char, so keywords need the real preceding text.
	return REGEX_PRECEDING_KEYWORD.test(text.slice(Math.max(0, index - 16), index));
}

function extractAll(text) {
	const fns = new Map();
	const unbounded = [];
	const re = /^(?:async\s+)?function\s+([一-鿿A-Za-z_$][一-鿿\w$]*)\s*\(/gm;
	let m;
	while ((m = re.exec(text))) {
		const name = m[1];
		let p = m.index + m[0].length - 1, paren = 0;
		for (; p < text.length; p++) {
			if (text[p] === '(') paren++;
			else if (text[p] === ')') { paren--; if (paren === 0) { p++; break; } }
		}
		const bodyStart = text.indexOf('{', p);
		if (bodyStart < 0) continue;
		const end = scanEndOfBlock(text, bodyStart);
		if (end < 0) { unbounded.push(name); continue; }
		if (!fns.has(name)) fns.set(name, text.slice(m.index, end));
	}
	return { fns, unbounded };
}

// Only strip a `//` that starts a comment. Stripping unconditionally would eat the tail of any line
// holding a URL or a regex, which silently makes two different lines compare equal.
const stripComments = (s) => s
	.split('\n')
	.map((line) => {
		let quote = '', escaped = false;
		for (let i = 0; i < line.length; i++) {
			const c = line[i];
			if (escaped) { escaped = false; continue; }
			if (c === '\\') { escaped = true; continue; }
			if (quote) { if (c === quote) quote = ''; continue; }
			if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
			if (c === '/' && line[i + 1] === '/') return line.slice(0, i).trim();
		}
		return line.trim();
	})
	.filter(Boolean)
	.join('\n');

const canonicalText = readFileSync(CANONICAL, 'utf8');
const panelText = readFileSync(PANEL, 'utf8');
const canonical = extractAll(canonicalText);
const panel = extractAll(panelText);

// ---------------------------------------------------------------------------------------------------
// Configuration parity. Function parity does NOT imply this: USER_CONFIG and ENGINE_DEFAULTS are object
// literals, and the panel's settings surfaces are an object literal plus an array of help entries, so a
// function-level comparison is blind to all of them. That blindness is not theoretical -- the panel's
// USER_CONFIG had gained DOH_SUBREQUEST_BUDGET that src/core/config.js never got, and the uplink queue
// caps were env-readable while appearing in no declared surface at all.
// ---------------------------------------------------------------------------------------------------
function objectKeys(text, declaration) {
	const start = text.indexOf(declaration);
	if (start < 0) return null;
	const open = text.indexOf('{', start);
	const end = scanEndOfBlock(text, open);
	if (end < 0) return null;
	// Match `KEY:` regardless of what the value expression is -- an object literal, a call, or an IIFE.
	// Requiring `KEY: {` reported a false positive the moment a row computed its value instead of
	// declaring one. Nested keys inside those values are lowercase (effective/env), so a SCREAMING_SNAKE
	// setting name cannot collide with them.
	// Top-level keys only, so nested object values cannot contribute phantom names.
	const body = text.slice(open + 1, end - 1);
	const keys = [];
	let depth = 0;
	for (const line of body.split('\n')) {
		const trimmed = line.trim();
		if (depth === 0) {
			const m = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:/);
			if (m) keys.push(m[1]);
		}
		for (const c of trimmed) {
			if (c === '{' || c === '[') depth++;
			else if (c === '}' || c === ']') depth--;
		}
	}
	return keys;
}

// Keys that legitimately do not appear in the panel's runtime settings view.
//   credentials/identity -- echoing these into /admin/env.json would leak them
//   subscription generation -- they shape emitted client configs, not the running data plane
//   FIRST_BYTE_TIMEOUT_MS -- superseded by the DIRECT_/PROXY_ pair, which already show it as their
//                            fallback env source, so listing it again would imply it still acts alone
const NOT_RUNTIME_SETTINGS = new Set([
	'ADMIN', 'KEY', 'UUID', 'HOST',
	'TRANSPORT', 'FP', 'FINGERPRINT', 'GRPC_MODE', 'GRPC_USER_AGENT', 'SUBNAME', 'SUB_UPDATE_TIME',
	'FIRST_BYTE_TIMEOUT_MS',
]);

// ---------------------------------------------------------------------------------------------------
// The entry handler. `export default { async fetch(...) }` is not a NAMED top-level function, so the
// function scan above never looked at it -- and a stale copy of the debug-flag initialisation survived
// there in the panel build, assigning the same module state twice. The handlers cannot be compared
// wholesale (the panel serves its admin UI inline and the canonical build fetches an external page), so
// pin the invariants that a diverging copy actually violates: statements that must appear exactly once,
// and anchor counts that must agree across builds.
// ---------------------------------------------------------------------------------------------------
function entryHandler(text) {
	const start = text.indexOf('export default {');
	if (start < 0) return null;
	const open = text.indexOf('{', start);
	const end = scanEndOfBlock(text, open);
	return end < 0 ? null : text.slice(start, end);
}

// Assigning module-level mutable state twice in one request is always either dead code or a bug.
const ASSIGN_EXACTLY_ONCE = [
	['调试日志打印', /^\s*调试日志打印 = \[/gm],
	['抑制旧文本日志', /^\s*抑制旧文本日志 = 调试日志打印/gm],
];
// Statements whose count must be IDENTICAL in every build, even though the handlers differ overall.
const ENTRY_ANCHORS = [
	['env merge', /env = applyUserConfigDefaults\(env\);/g],
	['identity resolution', /解析显式UUID\(env\.UUID \|\| env\.uuid\)/g],
	['derived-identity fallback', /await MD5MD5\(身份种子 \+ 加密秘钥\)/g],
	['/version handler', /const 版本日期 = String\(Version\)\.match/g],
	['tunnel context creation', /workerRequestContext\.tunnel = await createTunnelContext/g],
	['WS dispatch', /return await 处理WS请求\(/g],
	['gRPC dispatch', /return await 处理gRPC请求\(/g],
	['XHTTP dispatch', /return await 处理XHTTP请求\(/g],
];

const entryProblems = [];
{
	const entries = { [CANONICAL]: entryHandler(canonicalText), [PANEL]: entryHandler(panelText) };
	for (const [file, body] of Object.entries(entries)) {
		if (!body) { entryProblems.push(`could not locate the default fetch handler in ${file}`); continue; }
		for (const [label, re] of ASSIGN_EXACTLY_ONCE) {
			const n = (body.match(re) || []).length;
			if (n !== 1) entryProblems.push(`${file}: ${label} is assigned ${n} time(s) in the entry handler, expected exactly 1`);
		}
	}
	if (entries[CANONICAL] && entries[PANEL]) {
		for (const [label, re] of ENTRY_ANCHORS) {
			const a = (entries[CANONICAL].match(re) || []).length;
			const b = (entries[PANEL].match(re) || []).length;
			if (a !== b) entryProblems.push(`entry handler: ${label} appears ${a}x in the canonical build but ${b}x in the deployed panel build`);
		}
	}
}

const configProblems = [];
for (const decl of ['const USER_CONFIG = {', 'const ENGINE_DEFAULTS = {']) {
	const a = objectKeys(canonicalText, decl), b = objectKeys(panelText, decl);
	if (!a || !b) { configProblems.push(`could not read ${decl.slice(6, -4).trim()} from both builds`); continue; }
	const onlyCanonical = a.filter((k) => !b.includes(k));
	const onlyPanel = b.filter((k) => !a.includes(k));
	const name = decl.slice(6, -4).trim();
	if (onlyCanonical.length) configProblems.push(`${name}: missing from the panel build: ${onlyCanonical.join(', ')}`);
	if (onlyPanel.length) configProblems.push(`${name}: present only in the panel build: ${onlyPanel.join(', ')}`);
}

// Every operator-tunable USER_CONFIG key must be observable and documented in the panel, otherwise a
// setting can be honoured by the code while the operator has no way to confirm it took effect.
{
	const userKeys = objectKeys(panelText, 'const USER_CONFIG = {') || [];
	const viewStart = panelText.indexOf('function 构建生效设置视图(');
	const viewEnd = viewStart < 0 ? -1 : scanEndOfBlock(panelText, panelText.indexOf('{', viewStart));
	const view = viewStart < 0 || viewEnd < 0 ? '' : panelText.slice(viewStart, viewEnd);
	const helpKeys = new Set([...panelText.matchAll(/\{\s*k\s*:\s*'([A-Z][A-Z0-9_]+)'/g)].map((m) => m[1]));
	if (!view) configProblems.push('could not read 构建生效设置视图() from the panel build');
	else {
		for (const key of userKeys) {
			if (NOT_RUNTIME_SETTINGS.has(key)) continue;
			if (!new RegExp(`^\\s*${key}\\s*:`, 'm').test(view)) configProblems.push(`${key} is missing from the panel's effective-settings view`);
			if (!helpKeys.has(key)) configProblems.push(`${key} is missing from the panel's settings help list`);
		}
		// And the mirror direction. The panel renders ONLY from ENV_SETTINGS, so a key in the view with no
		// ENV_SETTINGS entry is invisible in the UI (that is how UUID_SOURCE reached /admin/env.json and
		// nowhere else), and a row whose key the view does not answer renders a permanently blank value.
		for (const key of helpKeys) {
			if (!new RegExp(`^\\s*${key}\\s*:`, 'm').test(view)) configProblems.push(`the panel renders a row for ${key} but the effective-settings view never returns it, so it shows blank`);
		}
	}
}

const missing = [], differs = [], allowedVariants = [];
for (const [name, body] of canonical.fns) {
	if (!panel.fns.has(name)) { if (!PANEL_MAY_OMIT.has(name)) missing.push(name); continue; }
	if (stripComments(body) === stripComments(panel.fns.get(name))) continue;
	if (INTENTIONAL_PANEL_VARIANTS.has(name)) { allowedVariants.push(name); continue; }
	differs.push(name);
}

console.log(`[panel-drift] canonical ${canonical.fns.size} fns, panel ${panel.fns.size} fns`);
if (allowedVariants.length) console.log(`[panel-drift] allowed panel variants: ${allowedVariants.join(', ')}`);

// A name the scanner could not bound is NOT a pass. Skipping it silently is how a checker ends up
// claiming a parity it never actually verified.
const unbounded = [...new Set([...canonical.unbounded, ...panel.unbounded])];
if (unbounded.length) {
	console.error(`[panel-drift] FAIL: could not determine the extent of ${unbounded.length} function(s): ${unbounded.join(', ')}`);
	process.exit(1);
}
if (entryProblems.length) {
	console.error(`[panel-drift] FAIL: entry-handler drift (${entryProblems.length}):`);
	for (const p of entryProblems) console.error(`  - ${p}`);
	process.exit(1);
}
console.log('[panel-drift] OK: the entry fetch handler agrees across builds');

if (configProblems.length) {
	console.error(`[panel-drift] FAIL: configuration drift (${configProblems.length}):`);
	for (const p of configProblems) console.error(`  - ${p}`);
	process.exit(1);
}
console.log('[panel-drift] OK: USER_CONFIG / ENGINE_DEFAULTS keys match and every tunable is shown in the panel');

if (missing.length) console.error(`[panel-drift] FAIL: missing from the deployed panel build: ${missing.join(', ')}`);
if (differs.length) console.error(`[panel-drift] FAIL: the deployed panel build has drifted in: ${differs.join(', ')}`);
if (missing.length || differs.length) {
	console.error('[panel-drift] src_static_ui/worker_test.js is the build that actually gets deployed. Port the change, or add a justified entry to INTENTIONAL_PANEL_VARIANTS.');
	process.exit(1);
}
console.log('[panel-drift] OK: the deployed panel build matches the canonical data plane');
