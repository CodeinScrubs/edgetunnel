import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The runtime's authentication check and the panel's UUID_SOURCE readout were once written twice, and
// drifted the moment the nil UUID was rejected in only one of them: the worker served on the derived
// identity while the panel said "explicit UUID accepted". Key-presence parity between builds cannot
// catch that -- two independently written expressions can both exist and still disagree -- so this
// suite executes the resolver and asserts BOTH surfaces route through it.
const BUILDS = ['_worker_copypaste.js', 'wrangler_deploy_method_worker/_worker.js', 'src_static_ui/worker_test.js'];

function extract(text, name) {
	let i = text.indexOf('function ' + name + '(');
	assert.ok(i >= 0, `missing ${name}`);
	let p = i + 9 + name.length, paren = 0;
	for (; p < text.length; p++) { if (text[p] === '(') paren++; else if (text[p] === ')') { paren--; if (paren === 0) { p++; break; } } }
	const open = text.indexOf('{', p);
	let d = 0, seen = false, j = open;
	for (; j < text.length; j++) { const c = text[j]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { j++; break; } } }
	return text.slice(i, j);
}

const CASES = [
	['unset', undefined, 'absent'],
	['empty string', '', 'absent'],
	['whitespace only', '   ', 'absent'],
	['v4', '8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04', 'valid'],
	['v5 (Xray custom-string mapping)', '8c9b1f2e-4a6d-5b31-9f27-1c3d5e7a9b04', 'valid'],
	['v1', '8c9b1f2e-4a6d-1b31-9f27-1c3d5e7a9b04', 'valid'],
	['v7', '8c9b1f2e-4a6d-7b31-9f27-1c3d5e7a9b04', 'valid'],
	['uppercase', '8C9B1F2E-4A6D-4B31-9F27-1C3D5E7A9B04', 'valid'],
	['surrounding whitespace', '  8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b04  ', 'valid'],
	['nil UUID', '00000000-0000-0000-0000-000000000000', 'invalid'],
	['too short', '8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9b0', 'invalid'],
	['non-hex', '8c9b1f2e-4a6d-4b31-9f27-1c3d5e7a9bzz', 'invalid'],
	['no dashes', '8c9b1f2e4a6d4b319f271c3d5e7a9b04', 'invalid'],
	['arbitrary string', 'my-custom-id', 'invalid'],
];

for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');
	const 解析显式UUID = new Function(
		'const UUID规范格式 = ' + (src.match(/const UUID规范格式 = (\/\^[^\n]*?\/i);/) || [])[1] +
		"; const NIL_UUID = '00000000-0000-0000-0000-000000000000';" +
		extract(src, '解析显式UUID') + 'return 解析显式UUID;')();

	for (const [label, input, expected] of CASES) {
		const got = 解析显式UUID(input);
		assert.equal(got.status, expected, `${file}: ${label} -> expected ${expected}, got ${got.status}`);
		if (expected === 'valid') {
			assert.equal(got.value, String(input).trim().toLowerCase(), `${file}: ${label} must normalise to trimmed lowercase`);
		} else {
			assert.equal(got.value, null, `${file}: ${label} must not yield a usable value`);
		}
		if (expected === 'invalid') assert.ok(got.reason, `${file}: ${label} must state a reason`);
	}

	// Both surfaces must ROUTE THROUGH the resolver rather than re-deriving the rule.
	assert.match(src, /const 显式UUID = 解析显式UUID\(env\.UUID \|\| env\.uuid\)/,
		`${file}: the runtime must resolve identity through 解析显式UUID`);
	assert.doesNotMatch(src, /const uuidRegex =/,
		`${file}: the old duplicated uuidRegex must be gone`);
}

// Panel-only: the UUID_SOURCE row must call the resolver, and must never echo the credential.
{
	const panel = readFileSync('src_static_ui/worker_test.js', 'utf8');
	const row = panel.match(/UUID_SOURCE: \(\(\) => \{[\s\S]*?\}\)\(\),/)?.[0] || '';
	assert.ok(row, 'panel UUID_SOURCE row not found');
	assert.match(row, /解析显式UUID\(e\?\.UUID \|\| e\?\.uuid\)/, 'panel UUID_SOURCE must call the shared resolver');
	assert.doesNotMatch(row, /\[0-9a-f/i, 'panel UUID_SOURCE must not re-implement the pattern');
	assert.match(row, /env: \(e\?\.UUID \|\| e\?\.uuid\) \? '\(set\)' : null/, 'panel must report presence, never the value');
}

// Read-only rows are a distinct kind of panel entry: they report state the worker computed, not a
// variable anyone can set. If one leaked into the generated environment text, an operator would paste
// UUID_SOURCE=... into Cloudflare as though it were configuration.
{
	const panel = readFileSync('src_static_ui/worker_test.js', 'utf8');
	const settings = panel.match(/var ENV_SETTINGS=\[[\s\S]*?\n\];/)?.[0] || '';
	assert.ok(settings, 'ENV_SETTINGS block not found');
	assert.match(settings, /\{k:'UUID_SOURCE',ro:1/, 'UUID_SOURCE must be present and marked read-only');
	assert.match(settings, /\{g:'Identity'\}/, 'UUID_SOURCE should sit under an Identity heading');
	assert.match(panel, /s\.ro\?'<div class="envro">read-only<\/div>':'<input id="env_'/, 'read-only rows must render no override input');
	assert.match(panel, /var lines=\[\]; ENV_SETTINGS\.forEach\(function\(s\)\{if\(s\.g\|\|s\.ro\)return;/, 'generated env text must skip read-only rows');
	assert.match(panel, /env-clear[\s\S]{0,120}?if\(s\.g\|\|s\.ro\)return;/, 'the clear handler must skip read-only rows');
	assert.match(panel, /\.envro\{/, 'the .envro style must exist');
	// The value cell must still populate for read-only rows -- that is their entire purpose.
	assert.match(panel, /ENV_SETTINGS\.forEach\(function\(s\)\{\s*\n?\s*if\(s\.g\)return; var cell=\$\('envcur_'\+s\.k\)/,
		'loadEnv must still fill the value cell for every non-group row, read-only included');
}

// Logging must be armed before anything can log. These flags previously initialised ~55 lines after the
// env merge, so the identity warning was dropped on a cold isolate even with DEBUG=1.
for (const file of BUILDS) {
	const src = readFileSync(file, 'utf8');
	const merge = src.indexOf('env = applyUserConfigDefaults(env);');
	const debugInit = src.indexOf('调试日志打印 = [', merge);
	// Anchor on the stable prefix, not the full sentence: the wording changed when an invalid UUID began
	// failing closed, and pinning prose made this fail for a reason that had nothing to do with ordering.
	const identityLog = src.indexOf('[Identity] The configured UUID is invalid', merge);
	assert.ok(merge >= 0 && debugInit > merge, `${file}: debug flags must initialise after the env merge`);
	assert.ok(identityLog > debugInit, `${file}: the identity warning must come AFTER logging is armed`);
	assert.ok(debugInit - merge < 600, `${file}: debug flags initialise ${debugInit - merge} chars after the env merge; keep them adjacent so nothing logs into a disarmed logger`);
}

console.log('identity tests passed');
