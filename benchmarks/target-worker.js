const MAX_BYTES = 64 * 1024 * 1024;
const CHUNK_BYTES = 64 * 1024;

function clampSize(value, fallback = 1024 * 1024) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return fallback;
	return Math.min(MAX_BYTES, Math.round(parsed));
}

function deterministicChunk(size, offset = 0) {
	const chunk = new Uint8Array(size);
	for (let i = 0; i < chunk.byteLength; i++) chunk[i] = 65 + ((offset + i) % 26);
	return chunk;
}

function streamBytes(totalBytes) {
	let sent = 0;
	return new ReadableStream({
		pull(controller) {
			if (sent >= totalBytes) {
				controller.close();
				return;
			}
			const nextSize = Math.min(CHUNK_BYTES, totalBytes - sent);
			controller.enqueue(deterministicChunk(nextSize, sent));
			sent += nextSize;
		},
	});
}

async function countRequestBytes(request) {
	if (!request.body) return 0;
	const reader = request.body.getReader();
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value?.byteLength || 0;
		if (total > MAX_BYTES) throw new Error('Upload body too large');
	}
	return total;
}

function jsonResponse(value, status = 200) {
	return new Response(JSON.stringify(value, null, 2), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
		},
	});
}

export default {
	async fetch(request) {
		const url = new URL(request.url);
		const startedAt = Date.now();

		if (url.pathname === '/' || url.pathname === '/health') {
			return jsonResponse({
				ok: true,
				name: 'edgetunnel benchmark target',
				endpoints: ['/bytes/{size}', '/bytes?size=1048576', '/sink'],
			});
		}

		if (url.pathname === '/sink') {
			try {
				const bytes = await countRequestBytes(request);
				return jsonResponse({
					ok: true,
					receivedBytes: bytes,
					elapsedMs: Date.now() - startedAt,
				});
			} catch (error) {
				return jsonResponse({ ok: false, error: error?.message || String(error) }, 413);
			}
		}

		const bytesMatch = url.pathname.match(/^\/bytes\/(\d+)$/);
		if (bytesMatch || url.pathname === '/bytes') {
			const size = clampSize(bytesMatch?.[1] || url.searchParams.get('size'));
			return new Response(streamBytes(size), {
				headers: {
					'content-type': 'application/octet-stream',
					'content-length': String(size),
					'cache-control': 'no-store',
					'x-benchmark-bytes': String(size),
				},
			});
		}

		return jsonResponse({ ok: false, error: 'Not found' }, 404);
	},
};
