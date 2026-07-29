# 100 performance & stability ideas (latency, throughput, browsing, YouTube, stability)

**Read first — the hierarchy of impact:**
1. **Clean-IP RTT/loss (client-side)** dominates everything. TCP throughput ≈ window ÷ RTT; a low-ping, low-jitter front IP beats any worker micro-tweak.
2. **Transport / DNS / TLS / fragment** choices are the next tier (mostly client + a few env vars).
3. **Worker data-path tunables** (ENGINE_DEFAULTS) are real but secondary on the free plan.

**Rule:** each item is a hypothesis. Benchmark a *single-stream* test before/after and keep only what measurably helps. Things this project removed/avoids on purpose are **not** here (no ProxyIP scanning, no NAT64, no UDP/QUIC tunneling, no Reality, no inline admin UI, no cron).

Legend: **[C]** client app · **[E]** env var · **[S]** source/ENGINE_DEFAULTS edit + rebuild · **[N]** network/account.

## A. Clean IP & front-host selection (biggest lever)
1. [C] Pick a low-RTT **and** low-jitter Cloudflare IP as the node address — this single choice dominates throughput and smoothness.
2. [C] Test candidate IPs **per ISP** — the best clean IP differs across MCI/Irancell/MTN/etc.
3. [C] Probe several CF ranges (104.16–104.31, 172.64–172.71, 162.159.x) and keep the fastest for your ISP.
4. [C] Front via a stable clean host (you use curseforge.com) and pin its best-resolving IP as the node address.
5. [C] Add several clean IPs as separate nodes so the client can fail over when one degrades.
6. [C] Re-test clean IPs periodically — CF edge performance drifts week to week.
7. [C] Try alternate TLS ports (2053/2083/2087/2096/8443) — some are less throttled than 443 on some ISPs.
8. [C] Avoid port 80 / non-TLS nodes — slower and more DPI-prone.
9. [C] Use IPv4 literals on your IPv4-only network to avoid AAAA-lookup stalls.
10. [C] Keep SNI = your real domain (cdn.example.com) while fronting via the clean IP — best reachability + blends in.
11. [C] Rank candidates by lowest **jitter**, not just lowest average ping — jitter causes the saw-tooth you wanted to avoid.
12. [C] Test at your real usage hours — Iran's international bandwidth is heavily time-of-day dependent; tune for peak congestion.

## B. Client app settings (v2rayNG / v2rayN)
13. [C] Enable **TLS fragment** — splits the ClientHello to dodge SNI-based resets; fewer reconnects = lower effective latency in Iran.
14. [C] Tune fragment values (packets/length/interval) and test — bad values add latency; good ones stabilize the link.
15. [C] Keep **Mux OFF** for max single-stream throughput (downloads/YouTube). Only test ON if many-small-request browsing feels slow.
16. [C] If you do use Mux, cap concurrency (~4–8) — too high causes head-of-line blocking that hurts everything.
17. [C] Use **remote DNS** (resolve through the tunnel) with a clean resolver to avoid local DNS poisoning.
18. [C] Set the client domain strategy to **IPv4-only** to match your network and avoid AAAA timeouts.
19. [C] Use the **chrome** (or randomized) uTLS fingerprint for better handshake acceptance.
20. [C] Set **ALPN = h2** for gRPC (you do) so there's no protocol renegotiation.
21. [C] Raise client read/write buffer sizes if exposed — helps sustained throughput on high-RTT (high-BDP) links.
22. [C] Enable **TCP Fast Open** at the OS/client if available — saves a round trip on connect.
23. [C] Disable battery optimization for v2rayNG on Android so it isn't throttled in the background during streaming.
24. [C] Use **always-on VPN + block connections without VPN** — no leaks, no stalls falling back to direct.
25. [C] Keep the client/core updated — newer xray cores ship gRPC/TLS performance fixes.
26. [C] Turn off destination-override sniffing that rewrites SNI — it can break TLS and add retries.

## C. Transport & protocol
27. [C] gRPC "gun" mode (you use) is a solid default — reliable, blends as HTTP/2.
28. [C] Benchmark **gRPC vs WS vs XHTTP per ISP** — one is often clearly less throttled than the others.
29. [C/E] For WebSocket nodes, enable **0-RTT early data (ed=2560)** to cut first-byte latency when browsing.
30. [C] Keep gRPC serviceName/path short (you use "/") to minimize overhead.
31. [C] Prefer **VLESS** (you use) — lowest per-packet overhead (no extra crypto over TLS).
32. [C] Avoid Shadowsocks-over-TLS unless needed — it adds a cipher layer (CPU) on top of the TLS the Worker already rides.
33. [C] Use one transport consistently across nodes — simpler failover, fewer surprises.
34. [C] Don't use XHTTP for big sustained downloads unless you've tested it beats gRPC for you.

## D. DNS & resolution
35. [E] Keep worker **DoH** on (cloudflare-dns.com) — avoids a TCP handshake per DNS query (lower, steadier latency).
36. [E] If CF DoH is slow from your colo, try `DOH_URL=https://dns.google/dns-query` and compare.
37. [S] Keep the in-memory DNS result cache — repeated lookups serve instantly.
38. [S] Nudge `DNS_RESULT_CACHE_MIN/MAX_TTL_MS` up so hot domains stay cached longer (fewer lookups).
39. [E] Leave `DNS_TIMEOUT_MS` at default unless your resolver is reliably fast; too low causes premature DNS failures.
40. [C] Route proxied-domain DNS through the tunnel; keep domestic DNS direct (split DNS).
41. [C] Use a single fast client resolver, not many — fewer parallel lookups per page.
42. [C] Avoid client DoH endpoints that are blocked/slow from Iran.
43. [C] If the app supports a hosts map, pin a few hot domains client-side to skip lookups.
44. [E] Leave `PRELOAD_RACE_DIAL` **off** — it adds an A+AAAA DoH lookup per dial; only worth it for multi-IP hostname targets.

## E. TLS / handshake
45. [N] Keep TLS 1.3 (CF default) — 1-RTT handshakes beat 1.2.
46. [C] Use 0-RTT early data (WS) for repeat connections so browsing approaches 0-RTT first byte.
47. [C] Reuse/pool connections where the client allows — amortizes the handshake across requests.
48. [C] Keep "skip cert verify" OFF — it gives zero speed and only risk.
49. [C] Match SNI to a real CF-served domain so the handshake completes fast and looks normal.
50. [C] **Leave ECH off** — it doesn't complete reliably and can break connections in Iran; pure latency cost for no gain right now.
51. [C] Keep the fingerprint stable (chrome) so middleboxes don't re-challenge the handshake.

## F. Worker connection tuning (env vars)
52. [E] `CONNECT_TIMEOUT_MS` ~700–850 for snappy failover on a good clean IP; raise toward 1200–1500 only if connects fail.
53. [E] `DIAL_STAGGER_MS` — **keep the `90` default; do NOT set `0`.** Our A/B run (`benchmark-runs/candidate-dial-stagger-0-*`) showed `0` collapses ProxyIP success rate and inflates tail latency (all candidates fired at once contend on the shared relay).
54. [E] Keep dial concurrency low (1–2) — more isn't faster on a single clean IP and burns CPU.
55. [E] Keep the proxy-resolution **KV cache on** (default) — fewer repeat resolutions.
56. [E] For CF-hosted sites that hit Error 1034, the built-in **community ProxyIP relay** fallback handles them; set a specific `PROXYIP=host:port` only if the community relay is slow for you.
57. [E] Keep camouflage `URL` as `nginx` (no outbound) so non-proxy hits cost nothing.
58. [E] Turn `DEBUG` **off** in normal operation — logging adds per-request work.
59. [E] Turn `ENABLE_KV_LOG` **off** in normal operation — KV writes on the request path add latency/quota.
60. [E] Measure your ISP's typical connect RTT and set `CONNECT_TIMEOUT_MS` a bit above it (not far above).

## G. Worker data-path / buffering (edit `src/core/config.js` ENGINE_DEFAULTS, rebuild, benchmark)
61. [S] Raise `DOWNLINK_BACKPRESSURE_HWM_BYTES` (256KB → 512KB–1MB) on a fast link to buffer more and lift throughput (costs isolate memory).
62. [S] Tune `WS_BUFFERED_AMOUNT_LIMIT_BYTES` (1MB) — higher for fast clients, lower to bound memory on slow ones (WS nodes only).
63. [S] Leave `GRPC_MAX_FRAME_PAYLOAD_BYTES` (4MB) generous — shrinking it adds framing overhead.
64. [S] Test larger `UPLINK_BUNDLE_TARGET_BYTES` (16KB → 32–64KB) to coalesce small writes → better upload throughput.
65. [S] Keep `UPLINK_QUEUE_MAX_BYTES/ITEMS` generous so bursty uploads don't stall.
66. [S] Tune `DOWNLINK_GRAIN_PACKET_BYTES` (32KB): larger = fewer sends = higher throughput; smaller = lower latency. Pick per goal.
67. [S] Keep `DOWNLINK_GRAIN_QUIET_MS=0` — no artificial delay = lower latency.
68. [S] Keep `WS_EARLY_DATA_MAX_BYTES` (8KB) — enough to carry the first request in the handshake.
69. [S] Keep crypto off the hot path — VLESS+gRPC+TLS avoids the in-Worker JS-TLS client (that runs only on HTTPS/TURN/SSTP proxy paths).

## H. Routing / split-tunnel (client)
70. [C] Split-tunnel: proxy only foreign sites; send domestic/Iranian traffic **direct** → less load, lower local latency.
71. [C] Bypass LAN/private ranges direct (don't tunnel local traffic).
72. [C] Send domestic CDNs direct (geosite:ir → direct) — they're faster locally.
73. [C] Tunnel DNS only for proxied domains; resolve domestic domains locally.
74. [C] Block ads/trackers client-side (geosite:category-ads) — fewer connections → faster pages and less tunnel load.
75. [C] Keep QUIC/UDP 443 blocked client-side (you do) so apps use TCP, which the tunnel can carry.
76. [C] Use per-app proxy (Android) so only the apps that need it contend for the tunnel.
77. [C] Order routing rules cheap→specific (direct LAN/domestic first) so most packets take the fast path.

## I. YouTube / streaming
78. [C] Block UDP 443 (done) so YouTube uses TCP/TLS (tunnelable) instead of QUIC (not tunnelable here).
79. [C] Choose a clean IP with low RTT to googlevideo.com — play a clip and watch for buffering; swap IPs if it stalls.
80. [C] Prefer a front IP/colo that routes to a nearby Google cache — varies by IP; test a few.
81. [S] Keep backpressure HWM high enough that the player buffer fills smoothly (avoid micro-stalls).
82. [C] Use a stable transport (gRPC) so adaptive bitrate doesn't thrash on resets.
83. [C] Use a steady DNS so YouTube doesn't keep switching CDNs mid-stream.
84. [C] For 1080p+, ensure single-stream throughput is enough — a low-RTT clean IP matters far more than worker tuning.
85. [C] If it buffers, first try another clean IP/port; it's almost always an IP/RTT issue, not the worker.

## J. Browsing snappiness
86. [E/S] Minimize DNS latency (DoH + caching) — first byte on a new domain is dominated by DNS.
87. [E] Keep connect latency low (a good clean IP + the default `DIAL_STAGGER_MS=90` — see item 53; `0` measured worse) so new connections open fast.
88. [C] Use 0-RTT early data (WS) so repeat requests skip a round trip.
89. [C] Block ads/trackers — fewer requests per page = visibly faster loads.
90. [C] Keep the tunnel warm (always-on) so the first click isn't a cold connect.
91. [C] On a lossy link, test browsing with Mux off vs on — head-of-line blocking can make Mux feel slower.

## K. Stability / resilience
92. [C] Put several nodes (different clean IPs/ports) in the subscription for automatic failover.
93. [C] Include a backup node on a different transport (e.g., a WS node beside gRPC) in case one is throttled.
94. [C] Enable client auto-reconnect with a short interval for seamless recovery after drops.
95. [C] "Block connections without VPN" so a dropped tunnel doesn't leak or stall on direct.
96. [N] Keep a second worker (different random name) as a hot standby in case one is ever flagged.
97. [C] Set a sane subscription auto-update interval (6–12h) so IP/node changes propagate.
98. [E] Use `wrangler tail` with `DEBUG=1` briefly to catch resets/errors, then turn it off.
99. [N] Benchmark before/after every change with a single-stream test; keep only measurable wins (project rule).
100. [N] Keep `compatibility_date` current and always rebuild from `src` (`npm run build`) so you get runtime perf fixes.

## The ~10 highest-impact (do these first)
#1–4 (clean low-RTT/low-jitter IP) · #13 (TLS fragment) · #28 (test transport per ISP) · #70 (split-tunnel) · #74 (block ads) · #78 (block QUIC, done) · #52 (connect timeout) · #99 (benchmark each change).
