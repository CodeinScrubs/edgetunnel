import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 创建上行写入队列 is the single byte pump every transport uploads through, and a completion promise it
// fails to settle parks that transport's upload loop forever with no error surfaced anywhere.
//
// That happened: ownership of an item's completions was claimed only AFTER 获取写入器() succeeded, but
// bundle() had already removed the item from `chunks`. When the getter returned null -- what the WS and
// gRPC getters do the moment remoteConnWrapper.socket is gone -- the item was in neither the queue nor
// activeCompletions, so nothing could ever settle it.
//
// This suite pins the lifecycle invariant at every failure boundary rather than just the one that broke.
const src = readFileSync('src/worker.js', 'utf8');

function extract(text, name) {
	let i = text.indexOf('async function ' + name + '('); let kw = 'async function ';
	if (i < 0) { i = text.indexOf('function ' + name + '('); kw = 'function '; }
	assert.ok(i >= 0, `missing ${name} in src/worker.js`);
	let p = i + kw.length + name.length, paren = 0;
	for (; p < text.length; p++) { if (text[p] === '(') paren++; else if (text[p] === ')') { paren--; if (paren === 0) { p++; break; } } }
	const open = text.indexOf('{', p);
	let d = 0, seen = false, j = open;
	for (; j < text.length; j++) { const c = text[j]; if (c === '{') { d++; seen = true; } else if (c === '}') { d--; if (seen && d === 0) { j++; break; } } }
	return text.slice(i, j);
}

const 建队列 = new Function(
	'const 上行合包目标字节 = 16384, 上行队列最大字节 = 16777216, 上行队列最大条目 = 4096;' +
	'let 调试日志打印 = true;' +
	'const log = () => {};' +
	'function withOperationTimeout(p) { return p; }' +
	extract(src, '数据转Uint8Array') +
	extract(src, '创建上行写入队列') +
	'return 创建上行写入队列;')();

const 静置 = () => new Promise((r) => setTimeout(r, 30));

// An unsettled promise is the whole failure mode, so track settle COUNT, not just final state.
function track(promise) {
	const rec = { settles: 0, state: 'pending' };
	promise.then(() => { rec.settles++; rec.state = 'resolved'; }, () => { rec.settles++; rec.state = 'rejected'; });
	return rec;
}

const unhandled = [];
process.on('unhandledRejection', (reason) => unhandled.push(reason));

async function 检查(标签, 选项, { 期望状态, 载荷 = new Uint8Array([1, 2, 3]), 之后 = null } = {}) {
	let 关闭次数 = 0;
	const q = 建队列({ 关闭连接: () => { 关闭次数++; }, 释放写入器: () => { }, 名称: 标签, ...选项 });
	const rec = track(q.写入并等待(载荷));
	await 静置();
	if (之后) { await 之后(q); await 静置(); }

	assert.equal(rec.settles, 1, `${标签}: 写入并等待 must settle exactly once, got ${rec.settles} (state=${rec.state})`);
	if (期望状态) assert.equal(rec.state, 期望状态, `${标签}: expected ${期望状态}, got ${rec.state}`);

	const stats = q.获取统计?.();
	assert.equal(stats?.inFlightBytes, 0, `${标签}: inFlightBytes must return to 0, got ${stats?.inFlightBytes}`);
	assert.equal(stats?.queuedBytes, 0, `${标签}: queuedBytes must return to 0, got ${stats?.queuedBytes}`);

	let idle = false;
	q.等待空().then(() => { idle = true; });
	await 静置();
	assert.ok(idle, `${标签}: 等待空() must settle`);
	assert.ok(关闭次数 <= 1, `${标签}: close callback ran ${关闭次数} times, expected at most once`);
	return q;
}

// --- the failure boundaries -------------------------------------------------------------------------
await 检查('writer-null', { 获取写入器: () => null }, { 期望状态: 'rejected' });
await 检查('writer-throws', { 获取写入器: () => { throw new Error('socket gone'); } }, { 期望状态: 'rejected' });
await 检查('write-rejects-sync', { 获取写入器: () => ({ write: () => { throw new Error('sync boom'); } }) }, { 期望状态: 'rejected' });
await 检查('write-rejects-async', { 获取写入器: () => ({ write: async () => { throw new Error('async boom'); } }) }, { 期望状态: 'rejected' });
await 检查('write-succeeds', { 获取写入器: () => ({ write: async () => { } }) }, { 期望状态: 'resolved' });

// 清空() while a write is still pending must reject the in-flight completion, not strand it.
{
	let release;
	await 检查('clear-during-write',
		{ 获取写入器: () => ({ write: () => new Promise((_, rej) => { release = rej; }) }) },
		{ 期望状态: 'rejected', 之后: async (q) => { q.清空(new Error('torn down')); release?.(new Error('torn down')); } });
}

// A socket dying mid-write: the write rejects and the queue must not retain the completion.
{
	let fail;
	await 检查('socket-close-during-write',
		{ 获取写入器: () => ({ write: () => new Promise((_, rej) => { fail = rej; }) }) },
		{ 期望状态: 'rejected', 之后: async () => { fail?.(new Error('socket closed')); } });
}

// Overflow while one item is active: the overflow error must settle everything, leaving nothing pending.
{
	let 关闭次数 = 0, release;
	const q = 建队列({
		获取写入器: () => ({ write: () => new Promise((res) => { release = res; }) }),
		释放写入器: () => { }, 关闭连接: () => { 关闭次数++; },
		最大字节: 4096, 最大条目: 4, 名称: 'overflow',
	});
	const first = track(q.写入并等待(new Uint8Array(1024)));
	await 静置();
	let overflowThrown = false;
	try { q.写入并等待(new Uint8Array(8192)); } catch (err) { overflowThrown = err?.isQueueOverflow === true; }
	await 静置();
	assert.ok(overflowThrown, 'overflow: admission must throw a tagged overflow error');
	release?.();
	await 静置();
	assert.equal(first.settles, 1, `overflow: the active write must settle exactly once, got ${first.settles}`);
	assert.equal(q.获取统计?.().inFlightBytes, 0, 'overflow: inFlightBytes must return to 0');
	assert.ok(关闭次数 <= 1, `overflow: close callback ran ${关闭次数} times`);
}

// Several queued items when the socket dies partway: every one must settle, none stranded.
{
	let n = 0;
	const q = 建队列({
		获取写入器: () => (++n <= 1 ? { write: async () => { } } : null),
		释放写入器: () => { }, 关闭连接: () => { }, 名称: 'mid-queue-death',
	});
	const recs = [q.写入并等待(new Uint8Array(20000)), q.写入并等待(new Uint8Array(20000)), q.写入并等待(new Uint8Array(20000))].map(track);
	await 静置();
    const stranded = recs.filter((r) => r.settles !== 1);
	assert.equal(stranded.length, 0, `mid-queue death stranded ${stranded.length} of ${recs.length} writes`);
	assert.equal(q.获取统计?.().inFlightBytes, 0, 'mid-queue death: inFlightBytes must return to 0');
}

// 写入开始/写入结束 drive remoteConnWrapper.活跃写入数; an unbalanced pair makes teardown mis-read how
// many writes are outstanding. They must stay balanced even when no writer was ever obtained.
// 统计上行 feeds the uplink byte total in a capture. It must count only bytes whose write RESOLVED --
// counting on attempt meant a connection that uploaded nothing still reported bytes sent.
for (const [标签, 获取写入器, 期望计数] of [
	['balanced-on-success', () => ({ write: async () => { } }), 4],
	['balanced-without-writer', () => null, 0],
	['not-counted-when-write-rejects', () => ({ write: async () => { throw new Error('nope'); } }), 0],
]) {
	let 开始 = 0, 结束 = 0, 已计上行 = 0;
	const q = 建队列({
		获取写入器, 释放写入器: () => { }, 关闭连接: () => { },
		写入开始: () => { 开始++; }, 写入结束: () => { 结束++; },
		统计上行: (bytes) => { 已计上行 += bytes; }, 名称: 标签,
	});
	track(q.写入并等待(new Uint8Array([1, 2, 3, 4])));
	await 静置();
	assert.equal(开始, 结束, `${标签}: 写入开始 (${开始}) and 写入结束 (${结束}) must stay balanced`);
	assert.equal(已计上行, 期望计数, `${标签}: uplink byte counter must only count bytes handed to a writer, got ${已计上行}`);
}

await 静置();
assert.deepEqual(unhandled, [], `queue produced ${unhandled.length} unhandled rejection(s)`);

console.log('uplink queue tests passed');
