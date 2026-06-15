# Environment variables — full reference

How config is resolved (highest priority wins):
**Cloudflare env var / Secret** → **KV `config.json`** (admin panel saves here) → **`USER_CONFIG`
defaults** (`src/core/config.js`) → **`ENGINE_DEFAULTS`**.

Set env vars in the Cloudflare dashboard: *Worker → Settings → Variables and Secrets*. Use a
**Secret** (encrypted) for `ADMIN`, `KEY`, `UUID`. Flags accept `1`/`true`/`on` (and `0`/`false`/`off`).

---

## 1. Identity & access (set these first)

| Var | Default | What it does | How to choose |
|---|---|---|---|
| `ADMIN` | — (required) | Admin-panel password. Also the fallback for `UUID` if neither `UUID` nor `KEY`-derivation is set. | A long random string. This is the only gate on your panel — make it strong. |
| `KEY` | `default-key-change-with-KEY-env-if-needed` | Secret used to derive the subscription token and the `UUID` (when `UUID` is unset). | Set a random value so your `UUID`/token aren't guessable from `ADMIN` alone. |
| `UUID` | derived from `ADMIN`+`KEY` | The VLESS/Trojan user id (this is a live credential — keep it secret). | Set a fixed UUID (e.g. from `uuidgen`) so it never changes across redeploys. |

## 2. Host & routing

| Var | Default | What it does | How to choose |
|---|---|---|---|
| `HOST` | request hostname | The host written into generated node links / subscription. | Set to your custom domain (e.g. `cdn.example.com`) so links are correct regardless of which URL hit the worker. |
| `PATH` | `/` | WebSocket/gRPC path (gRPC uses it as the serviceName). | Leave `/` unless you want a non-default path. A unique path is mild obfuscation. |
| `URL` | `nginx` | What a non-proxy visitor (or crawler) sees at `/`. `nginx` serves a fake nginx page; a real URL reverse-proxies that site as camouflage. | Leave `nginx`, or point at a believable site to look less like a proxy. |

## 3. Connection performance (the main tuning knobs)

| Var | Default | Range | What it does | How to tune |
|---|---|---|---|---|
| `CONNECT_TIMEOUT_MS` | `850` | 400–5000 | How long to wait for a TCP/handshake before giving up and trying the next IP/ProxyIP. | **Lower** = faster failover (snappier when an IP is bad) but may abandon slow-but-working paths. From Iran with a good clean IP, **600–900** is the sweet spot. For high-latency/lossy mobile networks you can now go up to **2000–3000**; raise if you see "connection failed" a lot, lower if recovery feels slow. |
| `DNS_TIMEOUT_MS` | `1200` (falls back to `CONNECT_TIMEOUT_MS`) | 400–5000 | Timeout for the DNS-over-TCP fallback path. | Usually leave default — DoH is the primary DNS path. Raise only if DNS resolution times out on a very slow link. |
| `DIAL_STAGGER_MS` | `90` | 0–500 | Delay between firing concurrent dial attempts (happy-eyeballs style). | `0` = fire all candidates at once (fastest connect, more connections opened). `90` balances speed vs. waste. Try `0`–`50` for lower connect latency. |
| `PRELOAD_RACE_DIAL` | off | flag | Resolves the target to multiple IPs and **races** them, keeping the fastest. | Turn **on** (`1`) to cut connect latency when a hostname has many IPs. Costs a few extra connection attempts. Worth trying for speed. |
| `DOWNLINK_BACKPRESSURE_HWM_BYTES` | `262144` (256 KB) | 64 KB–8 MB | Downstream buffer high-water mark — how much un-delivered data buffers before the worker pauses reading from the origin. **This is the main download-throughput knob.** | Raise (e.g. `524288` = 512 KB, or `1048576` = 1 MB) on **high-bandwidth × high-latency, low-loss** links to keep the TCP pipe full → higher download speed. No benefit on slow/lossy links; costs isolate memory. **Benchmark before/after** (see below). |

## 4. DNS

| Var | Default | What it does | How to choose |
|---|---|---|---|
| `DOH_URL` (or `DOH_ENDPOINT`) | `https://cloudflare-dns.com/dns-query` | Primary DNS — DNS-over-HTTPS (RFC 8484). Low, consistent latency. | Default is good. Alternatives: `https://dns.google/dns-query`. Pick whichever resolves fastest/unblocked from Cloudflare's edge. |
| `DNS_SERVER` (or `DNS_TCP_SERVER`) | `8.8.4.4:53` | DNS-over-TCP fallback if DoH fails. | Any reliable resolver `host:port`. Rarely needs changing. |

## 5. Cloudflare access / ProxyIP

| Var | Default | What it does | How to choose |
|---|---|---|---|
| `PROXYIP` | `auto` (per-datacenter community relay) | The relay used to reach **Cloudflare-hosted** destinations (which can't be dialed directly — Error 1034). | `auto` uses a shared community relay (variable quality). For reliability, set a specific working `host:port`. Most of your traffic uses your clean front IP directly, so this only matters for CF-hosted sites. |
| `GO2SOCKS5` | — | Comma/newline list of domains forced through a SOCKS5 upstream (configured via chain-proxy). | Advanced. Leave unset unless you run a SOCKS5 upstream. |

## 6. Caching, logging & debug

| Var | Default | What it does | How to choose |
|---|---|---|---|
| `ENABLE_KV_PROXY_CACHE` / `KV_PROXY_CACHE` | **on** | Persists resolved ProxyIP endpoints in KV (fewer repeat DNS lookups). Writes are globally throttled (≤ ~480/day) so they can't exhaust the free-plan 1000/day KV quota. | Leave on. Disable with `OFF_PROXY_CACHE=1` only if you don't want any KV writes. |
| `ENABLE_KV_LOG` / `KV_LOG` | off | Logs requests to KV (visible in the admin "operation log"). | Turn on briefly to inspect usage/errors, then off — it consumes KV writes. `OFF_LOG=1` force-disables. |
| `LOG_TTL_DAYS` / `LOG_TTL_SECONDS` | 7 days | How long log entries live. | Lower to save KV. |
| `LOG_READ_LIMIT` | 500 (max 1000) | Max log rows the panel reads. | Cosmetic. |
| `DEBUG` | off | Verbose `[TCP forwarding]`/`[ProxyIP]`/`[UDP forwarding]` logs, visible via `wrangler tail`. | Turn on (`1`) only while debugging with `npx wrangler tail <name>`, then off. |

## 7. Node-generation defaults (usually set in the panel, but available as env)

| Var | Default | What it does |
|---|---|---|
| `TRANSPORT` | `ws` | Default transport for generated links (`ws` / `grpc` / `xhttp`). Yours uses gRPC. |
| `FP` / `FINGERPRINT` | `chrome` | TLS fingerprint advertised by the client config. `chrome` supports ECH. |
| `GRPC_MODE` | `gun` | gRPC mode (`gun` normal / `multi`). `gun` is the reliable default. |
| `GRPC_USER_AGENT` | — | Override the gRPC User-Agent string. |
| `SUBNAME` | `edgetunnel` | Subscription name shown in clients. |
| `SUB_UPDATE_TIME` | — | Subscription auto-update interval (hours). |
| `BEST_SUB` | off | Advanced: act as a "best-sub" generator backend. Leave off. |

---

## Quick recommendations for your setup (Iran, free plan, gRPC, custom domain)

1. **Pin identity:** set `UUID`, `KEY`, `ADMIN` as Secrets so they survive redeploys.
2. **Set `HOST` to your custom domain** so links are always correct.
3. **Try `PRELOAD_RACE_DIAL=1`** and **`DIAL_STAGGER_MS=0`** — likely lower connect latency.
4. **Keep `CONNECT_TIMEOUT_MS` ~700–850.** Lower it if failover feels slow; raise it if connections fail to establish.
5. **Consider enabling ECH** (panel → Encrypted Client Hello) — hides the SNI, which helps against SNI-based blocking. Your fingerprint already says `chrome (supportECH)`.
6. **Add a few backup clean IPs** to the preferred-address list so the subscription has fallbacks if your front IP degrades.
7. **Leave the proxy cache on; turn DEBUG/KV-log on only when investigating.**
