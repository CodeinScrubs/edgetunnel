// MINIMAL CONTROL WORKER — not a proxy at all.
// Deploy this (copy-paste) to a BRAND-NEW worker name.
//  - If this returns 200 "hello ok"  -> your account/domain is fine; the 1101 is about the proxy code/usage.
//  - If this returns 1101            -> the account or that worker name/route is hard-flagged; no code change helps.
export default {
	async fetch(request, env, ctx) {
		return new Response('hello ok', { status: 200, headers: { 'Content-Type': 'text/plain' } });
	}
};
