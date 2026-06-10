# Competitive Audit

Goal: fast VPN behavior on Cloudflare Workers, measured by low latency, low packet loss, high reliability, stable browsing/video startup, and high upload/download throughput.

## Ratings

| Project | Engine rating | Summary |
| --- | ---: | --- |
| Our deployed copy | 89/100 | Strongest verified Worker tunnel engine: WS, gRPC, XHTTP, bounded timeouts, staggered dialing, DNS TCP framing, proxy cache/health, and regression tests. |
| cmliu/edgetunnel | 81/100 | Strong upstream compatibility base with active community changes, but less locally hardened than our copy. |
| IRNova/Nova-Proxy | 76/100 | Good product/UX and feature claims, but public Worker is obfuscated, so engine claims need live verification. |
| BPB-Worker-Panel | 74/100 | Best modular/config-generation architecture, rich WARP/routing/DNS/client output, but narrower Worker tunnel runtime. |
| itsyebekhe/nahan | 53/100 | Clean and auditable, with useful D1/multi-user/config ideas, but a much thinner WS-only tunnel core from inspected code. |

## What Others Do Better

- BPB has the best source structure: `src/common`, `src/protocols`, `src/cores`, and typed config builders for Xray, sing-box, and Clash.
- BPB has stronger client-side config generation for WARP, DNS routing, fake DNS, fragments, and rich platform presets.
- Nahan has the cleanest top-level defaults pattern and an understandable small-engine shape.
- Nahan uses Cloudflare's documented `connect` import directly.
- cmliu remains the best upstream compatibility stream for edgetunnel-specific fixes.
- Nova has a polished one-click/product story and useful ideas around per-ISP clean IP workflows.

## What Ours Does Better

- Our live tunnel engine handles WebSocket, gRPC, and XHTTP paths.
- Our gRPC implementation has frame encode/decode, protobuf wrapper parsing, max-frame checks, and regression tests.
- Our outbound engine has direct-first behavior, proxy fallback, staggered candidate dialing, optional DoH preload racing, and cleanup of losing sockets.
- Our proxy layer supports ProxyIP, SOCKS5, HTTP, HTTPS CONNECT, TURN, SSTP, global/path/query modes, endpoint health, and optional KV-backed cache.
- Our DNS forwarding uses configurable DNS-over-TCP with timeouts and exact-frame reads.
- Our stream lifecycle code covers upload queue limits, downstream batching, client close, upstream EOF, early no-data retry, and cancellation cleanup.

## Borrow

- Borrow BPB's modular discipline and schema-oriented config generation.
- Borrow Nahan's top editable defaults pattern, but not its simpler stream engine.
- Borrow cmliu updates only through an upstream-sync checklist that preserves our hardening.
- Borrow Nova's UX ideas only after verifying readable code or live behavior.

## Avoid

- Do not assume README feature claims equal working engine behavior.
- Do not treat BPB gRPC/httpupgrade config generation as proof its Worker terminates those transports.
- Do not import Nova engine logic while the public Worker remains obfuscated.
- Do not simplify our stream bridge to a basic `pipeTo` pattern; it is easier to read but weaker under long-lived VPN backpressure and early close cases.
- Do not tune gRPC, dial timing, DNS preload, or batching without benchmark evidence from the deployed custom domain.

## Next Engine Work

1. Keep `_worker.js` deployable and generated from `src/worker.js`.
2. Use `npm run verify-generated` before deployment to prove `_worker.js` matches `src/` without rewriting it.
3. Run the README post-deploy benchmark matrix before changing speed-related defaults: latency, burst, download, and upload profiles against the deployed custom domain.
4. Continue behavior-preserving extraction by moving one core function group at a time into `src/`.
5. Consider migrating the connector adapter to `cloudflare:sockets` only after proving parity on the current deployment.
