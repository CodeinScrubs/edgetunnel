# External Report Audit

This audit tracks third-party findings against the current worktree. Verdicts are based on code evidence, not on the report wording alone.

## High-Value Findings

| Finding | Verdict | Evidence | Impact | Action |
|---|---|---|---|---|
| Direct `ctx.waitUntil()` can throw when `ctx` is absent | Real | `src/worker.js` admin/subscription logging calls previously used direct `ctx.waitUntil(...)` | Compatibility/runtime reliability issue in tests or nonstandard runtimes; Cloudflare normally provides `ctx` | Fixed by optional chaining and guarded by a static test |
| Static admin page cache used query strings as cache keys | Real, partially fixed earlier | `fetchEnglishStaticPage('/admin' + url.search)` plus cache key from raw path | Extra GitHub Pages fetches and cache churn for admin UI; not tunnel-path latency | Fixed by normalizing cache keys for `/admin`, `/login`, `/noADMIN`, `/noKV` |
| Pure-JS Poly1305 uses BigInt | Real but overstated | `poly1305Mac()` in `src/worker.js`; used by custom HTTPS proxy TLS fallback | Can slow the custom HTTPS-proxy path when ChaCha20-Poly1305 is negotiated; does not decrypt/re-encrypt normal VLESS/gRPC/WS browsing traffic | Benchmark HTTPS-proxy path before rewriting; prefer avoiding ChaCha fallback or native TLS where possible |
| Reverse-proxy fallback buffers HTML with `response.text()` | Real but not tunnel core | Reverse camouflage path rewrites textual HTML to replace upstream host | Large HTML camouflage responses may add memory/latency; does not affect tunnel traffic | Low priority unless camouflage browsing is important; stream non-HTML already returns upstream response |
| DNS defaults point to Cloudflare DoH and Google DNS TCP | Real default, overstated as hardcoded-only | `DEFAULT_DOH_LOOKUP_URL`; `DEFAULT_DNS_TCP_SERVER`; overridden by `DOH_URL`, `DNS_SERVER`, `DNS_TCP_SERVER` | Bad regional resolver reachability can add preload/DNS latency if defaults are blocked | Document deployment override; benchmark with regional resolvers before changing defaults |
| SOCKS/HTTP/HTTPS handshakes can add RTTs | Mostly inherent, partly mitigated | Proxy handshakes are protocol-defined; current code has handshake timeouts | User feels slower first-open through chained proxies compared with direct/proxyIP | Optimize only after live proxy benchmarks; avoid proxy chains for fastest profiles |

## Needs Focused Audit

| Finding | Initial status | Why it matters |
|---|---|---|
| Global mutable debug flag | Likely real | Module-global debug state is written per request and can bleed logs across concurrent requests in reused isolates |
| Global proxy/SOCKS parsed-list caches | Mixed | Current keys include raw env values, so ordinary config changes refresh; still worth checking for mutation/staleness |
| MD5-derived admin/subscription tokens | Real design risk | Not directly speed-related, but security hardening matters before broader sharing |
| Default fallback secret | Real design risk if `KEY` is unset | User should set `KEY`; code could warn or require stronger defaults |
| Subscription conversion response buffering | Real | Large converted subscriptions can consume memory/latency; less important than tunnel data path |
| Rate limiting token misses | Missing | Useful abuse protection, but needs a storage strategy that does not recreate KV write pressure |
| Mixed-language identifiers | Real maintainability issue | Refactor risk is high; improve module-by-module, not in the hot path during tuning |

## False Or Low-Impact As Written

| Finding | Verdict | Notes |
|---|---|---|
| Poly1305 affects every TLS record for all browsing | False as written | It affects the Worker custom TLS implementation path, not normal tunneled client TLS |
| Static page cache is hardcoded to 8 entries | Outdated | Current `ENGINE_DEFAULTS.ENGLISH_STATIC_PAGE_CACHE_MAX_ENTRIES` is 32 |
| DoH always adds 50-200 ms to every new domain | Overstated | Preload race is optional and cached; direct dialing does not always require DoH first |

## Next Audit Steps

1. Add focused tests for request-local logging/debug behavior before changing the logging architecture.
2. Add live benchmark profiles for chained proxy modes if proxy chains are still part of the fast profile.
3. Measure the custom HTTPS proxy ChaCha fallback before attempting a risky Poly1305 rewrite.
4. Keep KV writes off by default; avoid rate-limit implementations that write KV on every failed subscription request.
