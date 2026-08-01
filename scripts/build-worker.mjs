import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcEntry = resolve(rootDir, 'src/worker.js');
// Copy-paste / Dashboard build (outbound TCP via request.fetcher.connect, no module imports).
const copypasteOut = resolve(rootDir, '_worker_copypaste.js');
// Wrangler build (outbound TCP via the documented cloudflare:sockets connect()).
const wranglerDir = resolve(rootDir, 'wrangler_deploy_method_worker');
const wranglerOut = resolve(wranglerDir, '_worker.js');
const checkOnly = process.argv.includes('--check');

async function readSource(path) {
	return readFile(path, 'utf8');
}

function stripModuleExports(source) {
	return source
		.replace(/\bexport\s+const\s+/g, 'const ')
		.replace(/\bexport\s+function\s+/g, 'function ')
		.replace(/\bexport\s+\{[^}]*\};?\s*/g, '');
}

async function inlineStaticImports(source, baseDir) {
	const importRegex = /^import\s+\{[^}]+\}\s+from\s+['"](\.\/[^'"]+|\.{2}\/[^'"]+)['"];\s*$/gm;
	let output = '';
	let lastIndex = 0;
	let match;

	while ((match = importRegex.exec(source))) {
		output += source.slice(lastIndex, match.index);
		const modulePath = resolve(baseDir, match[1]);
		const moduleSource = await readSource(modulePath);
		output += `${stripModuleExports(moduleSource).trim()}\n\n`;
		lastIndex = importRegex.lastIndex;
	}

	output += source.slice(lastIndex);
	return output;
}

const entrySource = await readSource(srcEntry);
const bundled = await inlineStaticImports(entrySource, dirname(srcEntry));

if (/^import\s+/m.test(bundled)) {
	throw new Error('Build left unresolved import statements in the bundled output');
}

// Stamp the build so a deployed worker can say WHICH build it is. The hardcoded Version string never
// changed across many deploys, which made a tail capture impossible to correlate with a specific artifact
// — the exact problem when handing internal-error references to Cloudflare support.
// Identify the build by a hash of the SOURCE it was generated from, not by the git commit.
//
// Stamping the commit SHA is self-referential: the generated files are committed alongside the source,
// so a build can only ever carry the PREVIOUS commit's SHA, and building from the working tree (which is
// always the case just before committing) marks every committed artifact '-dirty' forever. A source hash
// has none of that: identical source always yields the same stamp, it is stable across the commit that
// contains it, and it makes the generated files reproducible.
const { createHash } = await import('node:crypto');
const 源哈希 = createHash('sha256').update(bundled).digest('hex').slice(0, 12);
const 版本串 = `${new Date().toISOString().slice(0, 10)} src:${源哈希}`;

// Tag each artifact with its own variant name. The stamp is a hash of the SOURCE, so every generated
// build carried one identical marker and /version could not say which file was actually deployed --
// two artifacts with different bytes reported the same identity, which is exactly when you most need
// to tell them apart. The variant is appended rather than replacing the source hash: src: still
// answers "which source" and the suffix answers "which artifact". The hand-maintained panel build
// already used a ' panel' suffix, so this follows an existing convention. Hashing the artifact itself
// is not usable here -- stamping the hash into the file would change the file, and so the hash.
const banner = (variant) => [
	'// Generated from src/worker.js by scripts/build-worker.mjs.',
	'// Edit src/worker.js or src/core/config.js, then run npm run build.',
	`// Build: ${版本串} ${variant}`,
	'',
].join('\n');

// Replace the hardcoded Version with the real build stamp, so /version and any log that reports it
// identify the artifact actually running. src keeps a literal so it stays valid standalone.
const VERSION_RE = /^const Version = '[^']*';/m;
if (!VERSION_RE.test(bundled)) {
	throw new Error('Build could not find the Version literal to stamp');
}
const stamped = bundled.replace(VERSION_RE, `const Version = '${版本串}';`);
// Stamp the artifact's OWN content hash, not just the source hash. Two generated builds share one source
// and therefore one src: hash, so /version could not distinguish them -- and a hand-edited build could drift
// from its stamp entirely while still claiming to be current. Hashing the artifact directly is circular
// (writing the hash in changes the hash), so hash the text with BOTH stamp sites normalised to a
// placeholder first: that value is stable, unique per artifact, and changes whenever anything else does.
const 归一化戳 = (text) => text
	.replace(VERSION_RE, "const Version = '<stamp>';")
	.replace(/^\/\/ Build: .*$/m, '// Build: <stamp>');
const 产物哈希 = (text) => createHash('sha256').update(归一化戳(text)).digest('hex').slice(0, 8);

// --- Copy-paste / Dashboard build: identical bundle, request.fetcher.connect. ---
// Hash the FINISHED artifact, not the pre-banner bundle, so the value matches what a verifier recomputes
// from the file on disk. Non-circular because 归一化戳 blanks both stamp sites first: the draft below and
// the final output differ only in those two lines, so they normalise to identical text and therefore to the
// same hash. (panel-drift recomputes exactly this and fails if a build was edited after being stamped.)
const copypasteDraft = banner('copypaste') + stamped;
const copypasteId = `copypaste:${产物哈希(copypasteDraft)}`;
const copypasteOutput = banner(copypasteId) + stamped.replace(VERSION_RE, `const Version = '${版本串} ${copypasteId}';`);

// --- Wrangler build: same bundle, but the connect factory also uses cloudflare:sockets. ---
// The Dashboard editor mishandles the cloudflare:sockets module import (Error 1101), so this
// import is injected ONLY into the Wrangler build, which bundles the built-in correctly.
const FETCHER_CONNECT_BODY = `	if (!fetcher || typeof fetcher.connect !== 'function') throw new Error('request.fetcher.connect unavailable');
	return (options, init) => init === undefined ? fetcher.connect(options) : fetcher.connect(options, init);`;
const SOCKETS_CONNECT_BODY = `	if (fetcher && typeof fetcher.connect === 'function') {
		return (options, init) => init === undefined ? fetcher.connect(options) : fetcher.connect(options, init);
	}
	return (options, init) => init === undefined ? cloudflareConnect(options) : cloudflareConnect(options, init);`;

if (!stamped.includes(FETCHER_CONNECT_BODY)) {
	throw new Error('Build could not find the connect factory to produce the Wrangler (cloudflare:sockets) variant');
}
const wranglerBundle = stamped.replace(FETCHER_CONNECT_BODY, SOCKETS_CONNECT_BODY);
const wranglerPrefix = "import { connect as cloudflareConnect } from 'cloudflare:sockets';\n";
const wranglerDraft = wranglerPrefix + banner('wrangler') + wranglerBundle;
const wranglerId = `wrangler:${产物哈希(wranglerDraft)}`;
const wranglerOutput = wranglerPrefix + banner(wranglerId) + wranglerBundle.replace(VERSION_RE, `const Version = '${版本串} ${wranglerId}';`);

// The build stamp changes on every run (timestamp + git sha), so a byte-for-byte parity check would
// always fail. Normalise ONLY the two stamped lines before comparing — everything else must still match
// exactly, so the check keeps its whole purpose: proving the committed builds came from current src.
const 忽略构建戳 = (text) => text === null ? null : text
	.replace(/^\/\/ Build: .*$/m, '// Build: <stamp>')
	.replace(/^const Version = '[^']*';/m, "const Version = '<stamp>';");

if (checkOnly) {
	let ok = true;
	const currentCopypaste = await readFile(copypasteOut, 'utf8').catch(() => null);
	if (忽略构建戳(currentCopypaste) !== 忽略构建戳(copypasteOutput)) {
		console.error('_worker_copypaste.js is out of date. Run npm run build.');
		ok = false;
	}
	const currentWrangler = await readFile(wranglerOut, 'utf8').catch(() => null);
	if (忽略构建戳(currentWrangler) !== 忽略构建戳(wranglerOutput)) {
		console.error('wrangler_deploy_method_worker/_worker.js is out of date. Run npm run build.');
		ok = false;
	}
	if (!ok) process.exit(1);
	console.log('_worker_copypaste.js and wrangler_deploy_method_worker/_worker.js match src output');
} else {
	await writeFile(copypasteOut, copypasteOutput, 'utf8');
	await mkdir(wranglerDir, { recursive: true });
	await writeFile(wranglerOut, wranglerOutput, 'utf8');
	console.log('Built _worker_copypaste.js and wrangler_deploy_method_worker/_worker.js');
}
