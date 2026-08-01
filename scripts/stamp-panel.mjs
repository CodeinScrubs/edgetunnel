import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// src_static_ui/worker_test.js is HAND-MAINTAINED — it is not emitted by build-worker.mjs — and it is the
// build that actually gets deployed. Its version marker was therefore also maintained by hand, which meant
// it could drift arbitrarily far from the file's real contents while still claiming to be current: two
// revisions hundreds of lines apart reported the same identity, so /version could not tell them apart and
// could not be trusted to say what was running.
//
// Stamp it the same way the generated builds are stamped: hash the file with the version line itself
// normalised to a placeholder, so the value is stable (hashing the file with its own hash inside would be
// circular), unique to this artifact, and changes whenever anything else in the file does.
const PANEL = 'src_static_ui/worker_test.js';
const VERSION_RE = /^const Version = '[^']*';/m;

const 面板源 = await readFile(PANEL, 'utf8');
if (!VERSION_RE.test(面板源)) throw new Error(`${PANEL}: no Version literal to stamp`);

// The src: hash must match what build-worker.mjs derives, so all four surfaces agree on which source they
// came from. It bundles src/worker.js with src/core/config.js inlined; recompute the same way.
const 构建脚本 = await readFile('scripts/build-worker.mjs', 'utf8');
const 归一化 = (text) => text.replace(VERSION_RE, "const Version = '<stamp>';");
const 产物哈希 = createHash('sha256').update(归一化(面板源)).digest('hex').slice(0, 8);

const 日期 = new Date().toISOString().slice(0, 10);
// Read the source stamp straight off a generated build so it cannot disagree with them.
const 参考构建 = await readFile('_worker_copypaste.js', 'utf8').catch(() => '');
const 源哈希匹配 = 参考构建.match(/^const Version = '(\d{4}-\d{2}-\d{2}) (src:[0-9a-f]+)/m);
if (!源哈希匹配) throw new Error('Run npm run build first: the generated build has no readable stamp');
const 版本串 = `${源哈希匹配[1]} ${源哈希匹配[2]} panel:${产物哈希}`;

const 已标记 = 面板源.replace(VERSION_RE, `const Version = '${版本串}';`);
if (已标记 === 面板源) {
	console.log(`[stamp-panel] already current: ${版本串}`);
} else {
	await writeFile(PANEL, 已标记);
	console.log(`[stamp-panel] ${PANEL} -> ${版本串}`);
}
void 构建脚本;
void 日期;
