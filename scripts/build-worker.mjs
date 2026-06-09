import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcEntry = resolve(rootDir, 'src/worker.js');
const outFile = resolve(rootDir, '_worker.js');

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
	throw new Error('Build left unresolved import statements in _worker.js');
}

const banner = [
	'// Generated from src/worker.js by scripts/build-worker.mjs.',
	'// Edit src/worker.js or src/core/config.js, then run npm run build.',
	'',
].join('\n');

await writeFile(outFile, banner + bundled, 'utf8');
