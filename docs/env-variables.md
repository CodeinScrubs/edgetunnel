# Environment variables — complete, beginner-friendly reference

This page explains **every** environment variable the Worker understands: what it does in plain
language, its default, suggested values, and the pros/cons of changing it. If you only change one
thing, set `ADMIN`. Everything else is optional.

---

## How to add or change a variable (step by step)

1. Open the **Cloudflare dashboard** → **Workers & Pages** → your worker.
2. Go to **Settings → Variables and Secrets**.
3. Click **Add variable**. Type the **name** (exactly, UPPERCASE) and the **value**.
4. For passwords/IDs (`ADMIN`, `KEY`, `UUID`) click **Encrypt** so it becomes a **Secret** (hidden, safer).
5. Click **Save and deploy**. The change applies in a few seconds — **no code rebuild needed**.
6. After changing anything that affects the tunnel, **reconnect your client** (v2rayNG: toggle off/on).

**Value formats:**
- **On/off flags** (anything labeled "flag" below):
  - **To turn it ON:** add the variable and set its **value to `1`** (also accepted: `true`, `yes`, `on`).
  - **To turn it OFF:** set the value to `0` (also `false`/`no`/`off`), **or simply don't add it / delete it** — unset = off.
  - *Example:* to enable `PROXYIP_FALLBACK`, add a variable named `PROXYIP_FALLBACK` with value `1`.
- **Numbers** are plain digits (milliseconds or bytes, as noted). Out-of-range numbers are auto-clamped to the listed range.
- **Text** (`HOST`, `PATH`, `DOH_URL`, …) is the literal value.
- **Setting a variable to its current default has no effect** (e.g. `DOWNLINK_BACKPRESSURE_HWM_BYTES=262144` is the same as not setting it).
- **Priority:** a dashboard variable overrides the KV `config.json` (admin panel), which overrides the
  built-in defaults.

**One required binding (not a variable):** bind a **KV namespace** named **`KV`** (Settings → Bindings)
so the admin panel and config can be saved. Without it the panel can't store settings.

---

## 1. Identity & access — set these first

| Variable | Default | What it does |
|---|---|---|
| **`ADMIN`** | *none (required)* | Your **admin-panel password**. Also the seed for `UUID` if you don't set one. Aliases that do the same thing: `PASSWORD`, `password`, `pswd`, `TOKEN`, `admin`. |
| **`KEY`** | `default-key-change-with-KEY-env-if-needed` | A secret used to derive your subscription token and (if `UUID` is unset) your UUID. |
| **`UUID`** | derived from `ADMIN`+`KEY` | The VLESS/Trojan user id — **this is a live credential, keep it secret**. |

- **Suggested:** Set `ADMIN` to a long random password. Set `KEY` to another random string. Set `UUID`
  to a fixed value from any UUID generator (`uuidgen`) so it never changes when you redeploy.
- **Pros of setting all three explicitly:** your identity/token stay stable across redeploys and aren't
  guessable from the password alone. **Con of leaving them derived:** if you ever change `ADMIN`, your
  `UUID` and all node links change too, and every client must re-import.
- **Always make these Secrets (Encrypt).** Never commit them to a public repo.

---

## 2. Host & path

| Variable | Default | What it does | Suggested / pros & cons |
|---|---|---|---|
| **`HOST`** | the URL the request came in on | The hostname written into your generated node links / subscription. | **Set it to your custom domain** (e.g. `cdn.example.com`) so links are always correct no matter which URL hit the worker. No real downside. |
| **`PATH`** | `/` | Two jobs: (a) the WS **path** / gRPC **serviceName** used in generated links, and (b) a **tunnel path-gate** (see box below). | Default `/` = gate **off** (anything can reach the tunnel). Set a secret path like `/mypath` for stealth + less scanner load. **Con:** every client config must use the same path. |
| **`URL`** | `nginx` | What a normal visitor (or a bot) sees at `/`. `nginx` shows a fake nginx page (no outbound request). A real URL reverse-proxies that site as camouflage. | Leave `nginx`, or point at a believable site. Don't point it at a slow site (adds latency for nothing). |

> ### 📌 About `PATH` and the tunnel path-gate (important — read if you set a custom path)
> By default the worker treats **any** WebSocket upgrade or POST as a tunnel attempt, so internet
> scanners that hit your worker waste a little CPU. If you set `PATH` to something non-root, the worker
> **only** lets requests under that path into the tunnel; everything else gets the camouflage page.
>
> **How to use it:**
> 1. Set env `PATH=/mypath` (any secret-ish path).
> 2. In your client, set the gRPC **serviceName** (or WS **path**) to the **same** value.
> 3. Re-import your subscription / fix the node so it uses that path.
>
> **Slash-flexible:** `PATH=mypath` and `PATH=/mypath` both work, and your client may use `mypath` or
> `/mypath` — they all match. (Earlier this was strict; it's now normalized on both sides.)
> **Benefit:** scanners hitting `/` or random paths never reach the tunnel parser → less wasted CPU and
> better stealth. **Cost:** if the client path doesn't match, *your own* connection is rejected — that's
> the whole point, so keep them in sync.

---

## 3. Connection speed & reliability (the tuning knobs)

| Variable | Default | Range | What it does | How to choose |
|---|---|---|---|---|
| **`CONNECT_TIMEOUT_MS`** | `850` | 400–5000 | How long to wait for a TCP/handshake before giving up and trying the next IP/relay. | **Lower** = snappier failover when an IP is bad, but may abandon slow-but-working paths. Good clean IP from Iran: **700–900**. High-latency/lossy mobile: **1500–2500**. |
| **`DNS_TIMEOUT_MS`** | `1200` (else `CONNECT_TIMEOUT_MS`) | 400–5000 | Timeout for the DNS-over-TCP fallback. | Usually leave default (DoH is primary). Raise on very slow links. |
| **`DIAL_STAGGER_MS`** | `90` | 0–500 | Delay between firing parallel connection attempts. | `0` = fire candidates at once (fastest connect, one extra socket). `90` balances speed vs. waste. Try `0`–`40`. |
| **`PRELOAD_RACE_DIAL`** | off | flag | Resolve the target to multiple IPs (A+AAAA via DoH) and **race** them. | **Leave off.** It adds a DNS lookup per connection; only helps hostnames with many IPs. We measured it as net-neutral-to-negative for normal use. |
| **`FIRST_BYTE_TIMEOUT_MS`** | `0` (off) | 0–10000 | If a direct connection *opens* but sends **no data** within this many ms, cancel it and fall back to the ProxyIP relay. | **Off by default.** Turn on (try `1500`–`2500`) **only if you get "connected but page loads forever"** — it rescues blackholed routes. **Con:** a genuinely slow server (>your value to first byte) gets an unnecessary fallback. |

---

## 4. DNS

| Variable | Default | What it does | How to choose |
|---|---|---|---|
| **`DOH_URL`** (alias `DOH_ENDPOINT`) | `https://cloudflare-dns.com/dns-query` | Primary DNS — DNS-over-HTTPS. Avoids a TCP handshake per lookup. | Default is good. If it's slow from your datacenter, try `https://dns.google/dns-query`. |
| **`DOH_URL_FALLBACK`** | `https://dns.google/dns-query` | A **second** DoH endpoint tried for tunneled DNS if the primary fails, **before** dropping to plaintext DNS-over-TCP. | Leave default (Google). Only matters when the primary DoH is unreachable; adds resilience at no normal-path cost. |
| **`DNS_SERVER`** (alias `DNS_TCP_SERVER`) | `8.8.4.4:53` | DNS-over-TCP fallback if **both** DoH endpoints fail. | Any reliable resolver `host:port`. Rarely needs changing. |

---

## 5. Cloudflare-hosted-site access (ProxyIP)

Most sites you visit are reached **directly**. Sites hosted *on Cloudflare* can't be dialed directly
from a Worker (Error 1034) and use a relay called a **ProxyIP**.

| Variable | Default | What it does | How to choose |
|---|---|---|---|
| **`PROXYIP`** | `auto` (per-datacenter community relay) | The relay for Cloudflare-hosted destinations. | `auto` uses a shared community relay (variable quality). Set a specific `host:port` if you have a reliable one. Most of your traffic doesn't use this. |
| **`PROXYIP_FALLBACK`** | off | flag | When you set a **custom** `PROXYIP`, fallback is normally disabled. `PROXYIP_FALLBACK=1` keeps the community-relay fallback on, so a dead custom ProxyIP doesn't kill the connection. | Turn on if you set a custom `PROXYIP` and want resilience. N/A if you use `auto`. |
| **`GO2SOCKS5`** | none | Comma/newline list of domains forced through a SOCKS5 upstream. | Advanced; leave unset unless you run a SOCKS5 server. |

---

## 6. Throughput buffer (download-speed knob)

| Variable | Default | Range | What it does | How to choose |
|---|---|---|---|---|
| **`DOWNLINK_BACKPRESSURE_HWM_BYTES`** | `262144` (256 KB) | 64 KB – 8 MB | How much downloaded data the worker buffers before pausing the origin. **The main download-throughput dial.** | Raise (e.g. `524288`=512 KB or `1048576`=1 MB) on **fast + high-latency, low-loss** links to keep the pipe full → higher download speed. No benefit on slow/lossy links; uses more memory. **Benchmark single-stream before/after and keep only if it helps.** |
| **`DOWNLINK_GRAIN_PACKET_BYTES`** | `32768` (32 KB) | 4 KB – 1 MB | How big a chunk the worker accumulates before flushing it downstream (affects your gRPC downstream and the WS sender). | **Bigger** (e.g. `65536`=64 KB) = fewer, larger flushes → smoother sustained **download/video**. **Smaller** = lower latency for tiny responses but more overhead. Pair a big value with a big `DOWNLINK_BACKPRESSURE_HWM_BYTES`. Benchmark 32 KB vs 64 KB. |

---

## 7. Logging, cache & debug

| Variable | Default | What it does | How to choose |
|---|---|---|---|
| **`ENABLE_KV_PROXY_CACHE`** (alias `KV_PROXY_CACHE`) | **on** | Caches resolved ProxyIP endpoints in KV (fewer repeat lookups; writes are throttled so they can't blow the free 1000/day quota). | Leave on. Disable with `OFF_PROXY_CACHE=1` (or `DISABLE_KV_PROXY_CACHE=1`) only if you want zero KV writes. |
| **`ENABLE_KV_LOG`** (alias `KV_LOG`) | off | Logs requests to KV (visible in the admin "operation log"). | Turn on briefly to inspect usage, then off (it consumes KV writes). `OFF_LOG=1` force-disables. |
| **`LOG_TTL_DAYS`** / **`LOG_TTL_SECONDS`** | 7 days | How long log entries live. | Lower to save KV. |
| **`LOG_READ_LIMIT`** | 500 (max 1000) | Max log rows the panel reads at once. | Cosmetic. |
| **`DEBUG`** | off | Verbose `[TCP forwarding]` / `[ProxyIP]` / `[UDP forwarding]` logs, visible via `npx wrangler tail`. | Turn on (`1`) only while debugging, then off — logging adds a little overhead. |

---

## 8. Node-generation defaults (usually set in the admin panel, also available as env)

| Variable | Default | What it does |
|---|---|---|
| **`TRANSPORT`** | `ws` | Default transport for generated links: `ws` / `grpc` / `xhttp`. (You currently use gRPC.) |
| **`FP`** / **`FINGERPRINT`** | `chrome` | TLS fingerprint advertised by the client config. `chrome` supports ECH. |
| **`GRPC_MODE`** | `gun` | gRPC mode: `gun` (normal, reliable) or `multi`. |
| **`GRPC_USER_AGENT`** | none | Override the gRPC User-Agent string. |
| **`SUBNAME`** | `edgetunnel` | Subscription name shown in clients. |
| **`SUB_UPDATE_TIME`** | none | Subscription auto-update interval (hours) advertised to clients. |
| **`BEST_SUB`** | off | Advanced: act as a "best-sub" generator backend. Leave off. |

---

## Quick starting profiles

**Stable everyday (recommended):**
```
ADMIN=<long random>     KEY=<random>     UUID=<fixed uuid>
HOST=<your domain>      CONNECT_TIMEOUT_MS=850
```
**Stealth + less scanner load:** add
```
PATH=/your-secret-path   (and set the client gRPC serviceName / WS path to match)
```
**High-latency / flaky mobile:** add
```
CONNECT_TIMEOUT_MS=2000   FIRST_BYTE_TIMEOUT_MS=2000
```
**Chasing download speed (benchmark each value!):** try
```
DOWNLINK_BACKPRESSURE_HWM_BYTES=524288   then 1048576 — keep what measurably helps
```

## Things to leave alone (for your single-user Iran setup)
- **ECH** → keep off (unreliable / can break in Iran).
- **`PRELOAD_RACE_DIAL`** → off (adds DNS overhead).
- Don't try to tunnel **UDP/QUIC** — keep UDP 443 blocked client-side (the worker only carries TCP + DNS).
- Don't enable any auto-scanning/cron — that's what caused the original abuse flag.
