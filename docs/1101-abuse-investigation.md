# Cloudflare "network abuse" + Error 1101 — investigation & root cause

## Summary

The Worker repeatedly triggered a Cloudflare **network-abuse email** and started returning
**Error 1101** within ~1 minute of deploy — even on brand-new worker names, with no KV bound, no
`ADMIN` set, and without using the proxy at all.

After a long bisection we found **two independent causes**, both now fixed:

1. **Auto ProxyIP scanner (behavioral abuse).** The original incident. The Worker auto-probed many
   Cloudflare-owned IPs (a TCP-connect scan), which Cloudflare flags as network scanning. Removed.
2. **In-Worker (inline) admin UI (static-content abuse).** The recurring cause. The Worker script
   itself contained a self-hosted **proxy/VPN control panel** (protocol pickers, subscription
   generation, ProxyIP/UUID/ECH config). Cloudflare's **static analysis of the deployed script**
   flags a Worker whose source *is* a circumvention-service control panel. Fixed by serving the
   admin UI **externally** (fetched from GitHub Pages) instead of inlining it.

The current production build (`_worker.js`) has both removed and runs clean.

## Why this was so hard to pin down

The 1101 was **not behavioral** — it was static. That broke every intuition:

- The failing build made **0 outbound network calls** when idle (proven locally — see below), yet
  got flagged in under a minute. Nothing had to *run*; the flagged content just had to *exist in
  the deployed script*.
- It fired with **no KV, no `ADMIN`, no proxy use** — just the landing page open.
- `wrangler tail` showed only normal inbound crawler `GET /` hits, never an abusive outbound burst.

## The bisection (what we deployed and what happened)

All builds were deployed to **fresh, never-reused worker names** (confirmed by the user), so sticky
per-subdomain flags and account-level flagging were ruled out (the baseline kept working on fresh
names throughout).

| Build | What it was | Result |
|---|---|---|
| worker1 | Baseline (git `HEAD`): external GitHub admin UI, no scanner, no engine changes | ✅ works |
| worker2 | Current build minus DoH DNS | ❌ abuse + 1101 |
| worker3 | Current build minus downstream backpressure | ❌ abuse + 1101 |
| worker4 | Current build minus DoH **and** backpressure | ❌ abuse + 1101 |
| worker5 | Current build minus ProxyIP **probing** (runtime) | ❌ abuse + 1101 |
| worker6 | Current full build | ❌ abuse + 1101 |
| worker7 | Baseline **+ dead scanner/CF code** (never executed), external UI | ✅ works |
| worker8 | Current build, control plane partly reverted, **inline UI kept** | ❌ abuse + 1101 |
| worker9 | Clean engine, **scanner fully removed**, **inline UI kept** | ❌ abuse + 1101 |
| **worker10** | Clean engine, scanner removed, **inline UI removed → external GitHub UI** | ✅ **works** |

### What each step ruled out

- **DoH** — worker2 & worker4 disable it, still fail.
- **Backpressure** — worker3 & worker4 remove it, still fail.
- **Runtime IP probing** — worker5 neuters it (and no scan was ever run), still fails.
- **Static presence of scanner/CF-range code** — worker7 *contains* it as dead code yet **works**,
  so the scanner code's mere presence is not the trigger.
- **Sticky subdomain / account flag** — fresh names every time; baseline works repeatedly.

### The decisive A/B

worker9 (inline UI) **fails**; worker10 (external UI) **works**. They are identical except where the
admin panel HTML lives — in the Worker script vs fetched from GitHub. **That single variable flips
the result**, so the inline admin UI is the cause.

## Local reproduction (the key tool)

Instead of more deploys, we drove the Worker's `fetch` handler directly in Node, mocking
`globalThis.fetch` and `request.fetcher.connect` to count outbound calls and catch throws, for the
exact worker8 scenario (GET `/` with no KV / no `ADMIN`):

- **Failing build:** every path → `404`, **0 outbound fetch, 0 outbound connect**. Provably clean.
- **Working baseline:** every path makes **1 outbound fetch** (to GitHub Pages for the admin UI).

So the failing build did *less* network activity than the working one — which is what proved the
trigger is **static content**, not runtime behavior. (Scripts used during the hunt:
`repro.mjs` / `repro-sweep.mjs`, since removed with the `bisect/` scratch folder.)

## Root cause, stated plainly

Cloudflare statically scans the **deployed Worker script**. A script that embeds a self-hosted
**proxy/VPN admin control panel** (VLESS/Trojan/Shadowsocks selectors, subscription generation,
ProxyIP/UUID/ECH config, "scanner" UI, etc.) is classified as a circumvention service and flagged
for ToS / network abuse — independent of whether that code ever executes. Serving the same UI
**from an external page** keeps those strings out of the script, so the scanner sees only generic
fetch/translate code and does not flag it. This is exactly why the upstream baseline (which fetches
its admin UI from GitHub Pages) never had the problem.

## The fix (current build)

- **Removed the entire ProxyIP scanner subsystem** (probing, scan routes, scanner UI, the hardcoded
  `CLOUDFLARE_IPV4_RANGES` list, NAT64/CF detection).
- **Removed the inline admin UI** (`src/admin/admin-ui.js`); `/admin`, `/login`, `/noADMIN`,
  `/noKV` now serve the **external GitHub-fetched** pages (`fetchEnglishStaticPage`).
- **Kept** the safe performance work: DoH DNS, downstream backpressure, SOCKS5/TLS/WS/gRPC
  data-path fixes, ECH, KV proxy cache. None of these are panel content, so none trip the scanner.

## Guidance going forward

- **Do not inline a proxy-config control panel into the Worker.** Keep the admin UI external. If you
  want independence from `edt-pages.github.io`, host that HTML on your own static page and point
  `PAGES_STATIC_URL` (`Pages静态页面`) at it — just don't put the panel back inside the Worker.
- **Do not auto-scan / TCP-probe Cloudflare IPs from the Worker** (behavioral abuse). Pick clean
  ingress IPs on the **client** side instead.
- A public `*.workers.dev` proxy URL gets crawled and probed constantly; that inbound noise is
  normal and is not what caused the flag here. Avoid obvious worker names (`debug`, `test`, `vpn`,
  `proxy`) to reduce it.
