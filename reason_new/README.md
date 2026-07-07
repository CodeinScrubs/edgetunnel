# 1101 Bisection Kit

Both builds started returning **Error 1101** after working fine for days. This kit finds out *why*.

## The #1 suspect (read this first)

This project has a **documented 1101 history** (see `git log`: commit `9479fdb` "confirmed cause of the
1101", and the project notes on *per-worker proxy-usage detection*). Cloudflare flags a Worker that has
been **proxying a lot of traffic** and returns **1101 on every request, regardless of the code**. This is
operational, not code-fixable.

`newera` has been your live VPN for days. The most likely cause is simply that **`newera` got flagged for
usage** — nothing we changed in the code. The tests below prove or disprove that in ~5 minutes.

> **Golden rule for every test below: deploy each version to a BRAND-NEW, never-used worker name**
> (e.g. `t-hello`, `t-v3`, `t-v1`, `t-v2`). If you reuse `newera` (or any already-flagged name) everything
> will 1101 and you'll learn nothing. Copy-paste deploy is easiest and works for every version here.

---

## What's in this folder

| Folder / file | What it is | How to deploy |
|---|---|---|
| `v0_hello_control.js` | A minimal **non-proxy** "hello" worker | Copy-paste into a fresh worker |
| `v1_baseline/_worker.js` | **Pre-session** code (commit `81fb62a`, 8440 src lines) — known-good, before ANY of this session's changes | Copy-paste into a fresh worker |
| `v2_mid_hardened/` | Two-build split + review rounds 1–2 (commit `8d3c4f1`, +285 lines) | Copy-paste `_worker_copypaste.js`, **or** wrangler-deploy the `wrangler_deploy_method_worker/` |
| `v3_current/` | **Current** code (commit `48989f7`, +59 more lines: the VLESS-UDP round) | Same as v2 |

All three `*_copypaste` / `_worker.js` files are confirmed **free of `cloudflare:sockets`** (that import is
the *other* known 1101 cause and is correctly absent from every copy-paste build here).

---

## Run the tests in this order (stop as soon as you get an answer)

### TEST 1 — is it just `newera` being flagged?  (the likely answer)
Deploy **`v3_current`** (the current code) to a **fresh worker name** (`t-v3`).
- ✅ **Works** → `newera` was usage-flagged. **You're done: just run on the fresh worker.** The code is fine.
  (Expect this to happen — it fits the history.)
- ❌ **1101** → it's not just `newera`; the code/codebase is triggering it. Go to Test 2.

### TEST 2 — is the account/domain itself OK?
Deploy **`v0_hello_control.js`** to a **fresh worker name** (`t-hello`).
- ✅ **Works** → account/domain fine; Cloudflare is specifically detecting *proxy-shaped code*. Go to Test 3.
- ❌ **1101** → the **account or that domain/route is hard-flagged**. No worker code change fixes this —
  it's a Cloudflare account/abuse issue (different account, different domain, or contact CF).

### TEST 3 — is it OUR session's changes, or the base codebase?
Deploy **`v1_baseline/_worker.js`** (pre-session, known-good) to a **fresh worker name** (`t-v1`).
- ✅ **Works** → our session's changes introduced the trigger. Go to Test 4 to narrow which round.
- ❌ **1101** → the **base codebase** (unchanged from before this session) now 1101s too → Cloudflare
  tightened its proxy-code detection; this is characteristic-code flagging, not something we broke. The
  realistic fix is reducing the code's detectability (e.g. minification to strip the English proxy-terminology
  comments/strings), or a different account/approach — tell me and I'll build a minified variant to test.

### TEST 4 — which change-set broke it? (only if v1 works but v3 doesn't)
Deploy **`v2_mid_hardened/_worker_copypaste.js`** to a **fresh worker name** (`t-v2`).
- ✅ **v2 works** → the trigger is in the **v2 → v3** diff (the VLESS-UDP round, only ~59 lines). Tell me and
  I'll bisect those few changes into 2–3 more micro-versions to pinpoint the exact line.
- ❌ **v2 1101** → the trigger is in the **v1 → v2** diff (two-build split + review rounds 1–2). Tell me and
  I'll split that changeset into finer versions.

---

## Quickest possible path
If you only run one thing: **Test 1** (deploy `v3_current` to a fresh worker name). There's a strong chance
it just works and the whole thing was `newera` being usage-flagged — in which case the code is fine and you
deploy on the fresh name.

Report back which tests pass/1101 and I'll take it from there.
