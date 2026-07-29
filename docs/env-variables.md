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
| **`DNS_TIMEOUT_MS`** | `1200` | 400–5000 | Per-stage timeout for tunneled DNS (each DoH fetch, each DoH body read, and each DNS-over-TCP connect/write/read). | Usually leave default (DoH is primary). Raise on very slow links. **No longer inherits `CONNECT_TIMEOUT_MS`** — it used to, which meant raising the proxy dial timeout to 5s silently made every DNS stage 5s and let one failed lookup stall a page for ~35s. |
| **`WS_HALF_OPEN_TEARDOWN`** | off | flag | Makes the Worker take sole responsibility for completing the WebSocket Close handshake (`accept({allowHalfOpen:true})`) instead of letting the runtime answer the peer's Close frame. | **Leave off.** A DEBUG capture of 158 WS tunnels showed all 8 exception invocations — including all 5 runtime hangs — ended with the close already requested and `readyState` still `CLOSING`, while **not one** of 123 closes had queued bytes for half-open to protect. Final-upload safety comes from closing the *remote* socket after the drain, which happens either way. Only set `1` to A/B the old behaviour. |
| **`DOH_SUBREQUEST_BUDGET`** | `40` | 0 = unlimited, else 1–10000 | How many DNS-over-HTTPS lookups **one connection** may make before tunneled DNS switches to plaintext DNS-over-TCP. | The free plan allows 50 external subrequests **per invocation**, and a WebSocket tunnel is *one* invocation — so an unbounded session spends them all on DNS and leaves none for ProxyIP resolution. Cached answers never count against it. **Set `0` on a paid plan** (10000+ subrequests available), where capping at 40 would downgrade DNS to plaintext for no reason. A blank value counts as unset, not unlimited. |
| **`DNS_TOTAL_TIMEOUT_MS`** | `4000` | 1000–10000 | **One** absolute budget for a whole tunneled-DNS lookup, shared across every stage *and* the fallback resolver. When it runs out the worker stops and answers SERVFAIL immediately. | Leave the default. Without it the per-stage timeouts stack (~8.4 s for a single query, far more for a batch) — longer than a typical client's own ~5 s DNS timeout, so the client gives up first and the page just hangs. **Lower** (2000–3000) fails over to the client's own resolver sooner; **higher** only helps if your resolvers are genuinely slow rather than broken. |
| **`DIAL_STAGGER_MS`** | `90` | 0–500 | Delay between firing parallel connection attempts. | **Keep the `90` default.** Our own A/B run (`benchmark-runs/candidate-dial-stagger-0-*`) showed `0` collapses ProxyIP success rate (to ~0.06–0.3 on some hosts) and blows up tail latency — firing all candidates at once contends on the shared relay. Don't set `0`. |
| **`PRELOAD_RACE_DIAL`** | off | flag | Resolve the target to multiple IPs (A+AAAA via DoH) and **race** them. | **Leave off.** It adds a DNS lookup per connection; only helps hostnames with many IPs. We measured it as net-neutral-to-negative for normal use. |
| **`FIRST_BYTE_TIMEOUT_MS`** | `0` (off) | 0–15000 | If a connection *opens*, the client **sends a request**, but the remote returns **no byte** within this many ms, treat the route as blackholed. On **direct** it falls back to ProxyIP; on **ProxyIP** it closes so the client re-dials. Now safe to enable: the watchdog **only fires after a request was actually sent** (a browser *preconnect* no longer counts as a stall) and **never during an active upload**. | **Off by default.** Turn on **only if you get "connected but page loads forever."** Prefer the split vars below. Sets both routes unless a split var overrides it. |
| **`DIRECT_FIRST_BYTE_TIMEOUT_MS`** | falls back to `FIRST_BYTE_TIMEOUT_MS` | 1000–15000 | Direct-route blackhole deadline. Direct is normally very fast (measured p95 ~60 ms), so it can be aggressive. | **Recommended `3000`** if you want fast recovery from blocked/blackholed direct routes. |
| **`PROXY_FIRST_BYTE_TIMEOUT_MS`** | falls back to `FIRST_BYTE_TIMEOUT_MS` | 1000–15000 | ProxyIP-route blackhole deadline. ProxyIP is more variable (a healthy relay was measured as late as ~5.1 s to first byte), so keep it looser. | **Recommended `6000`** — above the slowest observed healthy relay so it isn't killed, while still dropping dead relays quickly. |
| **`DNS_TUNNEL_TCP_FIRST`** | `0` (off) | flag | For DNS tunneled *through* the proxy (a client that routes its own DNS over the tunnel), prefer DNS-over-TCP (`connect()`, no subrequest) before DoH (`fetch()`, one subrequest each). | **Leave off** unless a long-lived connection that tunnels lots of DNS is exhausting the Free-plan 50-subrequest-per-invocation budget. Only affects tunneled DNS, not the worker's own name resolution. |
| **`IDLE_TIMEOUT_MS`** | `0` (off) | 1000–600000 | After data is flowing, if the remote sends **nothing** for this many ms (a mid-stream stall), cancel and close so the client re-dials instead of freezing. | **Off by default.** Turn on (try `60000`–`120000`) **only if downloads/streams freeze and never recover.** Safe — only fires after the first byte, never replays. **Con:** set too low and it drops genuinely slow transfers; keep it generous. |
| **`UPLINK_WRITE_TIMEOUT_MS`** | `0` (off) | 1000–120000 | If a single write of uplink data to the remote never completes (a wedged outbound socket), cancel it after this many ms and tear the connection down so the client re-dials, instead of the upload path blocking forever. | **Off by default.** Turn on (try `30000`) **only if uploads occasionally wedge and never recover.** **Con:** a `writer.write()` also blocks under legitimate backpressure (a slow-but-alive upload), which this timeout can't tell apart — set it generously and leave it off unless you actually see stuck uploads. |
| **`UPLINK_QUEUE_MAX_BYTES`** | `16777216` (16 MiB) | 65536–67108864 | How many upload bytes **one connection** may retain in memory when the outbound socket is slower than the client feeding it. Past the cap the connection is closed rather than letting the queue grow. | **Leave default unless you see unrelated connections dying during large uploads.** The Free plan gives the whole isolate 128 MB *shared across every concurrent request*, so one connection retaining 16 MiB can evict others. Try `4194304` (4 MiB) if that happens. Raising it above the default is rarely right on Free. |
| **`UPLINK_QUEUE_MAX_ITEMS`** | `4096` | 16–65536 | The same backstop counted in queued chunks instead of bytes — it catches a flood of tiny writes that would never reach the byte cap. Both limits are checked; whichever trips first closes the connection. | **Leave default.** Lower it (`1024`) only alongside `UPLINK_QUEUE_MAX_BYTES` when hunting isolate-memory pressure. |
| **`DEBUG_LEGACY_TEXT`** | `1` (on) | flag | Only meaningful while `DEBUG=1`. Set `0` to emit the structured JSON telemetry **without** the human-readable text lines. | Set `0` when capturing a `wrangler tail` for later analysis — the text lines roughly double the volume and aren't machine-readable. No effect at all when `DEBUG=0`. |
| **`GRPC_HALF_CLOSE_ON_EOF`** | `0` (off) | flag | gRPC only. On a **normal request-body EOF**, half-close just the upstream (send FIN) and keep streaming the response to completion, instead of closing the whole connection. This is the correct bidirectional-gRPC lifecycle. | **Off by default.** xray "gun" keeps its stream open until teardown, so the default full-close never truncates it — leaving this off preserves the proven path. Turn on **only if a gRPC download gets cut off right after an upload finishes** (a client that half-closes its request stream mid-response). Safe to try; if your runtime doesn't support TCP half-close it simply behaves like today. |

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
| **`FORCE_PROXY_HOSTS`** | none | Comma/newline list of target host patterns that skip direct dialing and go straight through ProxyIP or the configured chain proxy. | Use for your own Cloudflare-hosted panel/custom domains, for example `panel.example.com,*.example.com`, when they fail only while tunneled. Leave unset for normal browsing. |
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
| **`DEBUG`** | off | Verbose routing logs **plus structured JSON per-connection telemetry** (one object per event) for every tunnel connection, visible via `npx wrangler tail`. See below. | Turn on (`1`) only while debugging, then off — logging adds a little overhead. |
| **`DEBUG_STAT_INTERVAL_MS`** | 15000 | Heartbeat (`stat`) interval, clamped 5 s–5 min. Raise it (e.g. 30000) if hundreds of connections make the tail too noisy. | Leave default for a single user. |
| **`DEBUG_LEGACY_TEXT`** | on | When `DEBUG=1`, also emit the old human-readable `[TCP forwarding]…` text lines. Set to `0` to emit **structured events only**. | **Set `0`** for any capture you'll analyze — the text lines roughly double the tail volume, which pushes `wrangler tail` into sampling mode (it silently drops messages). Warnings/errors still print. |

### Reading the DEBUG connection telemetry

> **Get complete close events:** by default the runtime cancels a gRPC "gun" invocation when the client disconnects, *before* the Worker's cleanup runs — so most connections never emit a `close`. To fix this, add the `enable_request_signal` compatibility flag to your `wrangler.toml` (`compatibility_flags = ["enable_request_signal"]`). The Worker then emits a `close` (with `reason:"client_abort"`) the moment the client disconnects. Without it, only cleanly-finished connections produce a `close` — but every `stat` heartbeat now also carries the queue/route/byte fields, so you can still reconstruct most of a connection from its last heartbeat.

With `DEBUG=1`, every tunnel connection (gRPC / WS / XHTTP) emits **structured JSON objects** — one per event — so an AI (or `jq`) can parse them without guessing units. Every event carries `ev` (event name), `conn` (a globally-unique id from CF-Ray), `t` (epoch ms) and `tr` (transport). All byte fields are **raw integers**; all rates are **bytes/second** (`*_bps`).

| `ev` | When | Key fields |
|---|---|---|
| `open` | connection accepted | `colo`, `country`, `asn`, `proto` (HTTP/2 etc.), `rtt_ms` (client↔Cloudflare RTT), `edge_bps` (edge delivery rate), `ip` |
| `route` | upstream route chosen | `route` (`direct`/`proxyip`/…), `endpoint` (winning ProxyIP), `dial_ms`, `target`, `port` |
| `dial_fail` | a dial attempt failed | `route`, `ms`, `err` |
| `fallback` | direct→ProxyIP (or re-dial) | `from`, `to`, `n` (fallback count) |
| `first_byte` | remote's first byte | `ttfb_ms` (open→first-byte — the best "instant-feel" metric), `route` |
| `stat` | heartbeat while open | now mirrors the key `close` fields (`route`, `endpoint`, `ttfb_ms`, `up_b`/`down_b`, `up_bps`/`down_bps`, `peak_*`, `dial_*`, `fallbacks`, `q_max_*`) — **so a connection that never emits a `close` is still fully reconstructable from its last heartbeat** |
| `dns` | a tunneled DNS query resolved | `up_b`, `down_b`, `resolver` (`doh`/`tcp`), `latency_ms` |
| `close` | connection ended | `reason` + **`expected`** (see below), `dur_ms`, `route`, `ttfb_ms`, `up_b`/`down_b`, `life_down_bps` (lifetime avg), `active_down_bps` (avg over active transfer only), `peak_down_bps`, `dial_attempts`/`dial_failures`/`fallbacks`, and `q_max_*` upload-queue high-water marks |

**`reason`/`expected` — read `expected` first.** `expected:true` = normal lifecycle end; `expected:false` = worth investigating. Precise reasons: `eof` / `remote_eof` / `remote_eof_no_data` (remote closed), `no_request_idle` (a browser *preconnect* — the client opened the tunnel but never sent a request; harmless, and it no longer poisons routing), `client_cancel` / `client_close` / `client_abort` (client left), `runtime_cancel` (normal stream cancel), `idle_timeout`; and the **unexpected** ones — `first_byte_timeout` (a route blackholed — a request was sent but no byte came back), `queue_overflow`, `error`. Count only `expected:false` as failures.

**How to capture a good trace (important — this is why an earlier attempt showed nothing):**

1. Set `DEBUG=1`, then **start `npx wrangler tail <worker-name> --format json > tail.jsonl` FIRST** and leave it running (JSON capture is far easier to analyze than pretty terminal output).
2. **Reconnect the client** (toggle the VPN off→on in v2rayN/xray). A gRPC "gun" connection is one long-lived POST — if the tail attaches *after* the client is already connected, the `open`/`route`/`first_byte` events already fired and you'll only see `stat` heartbeats. Reconnecting forces a fresh invocation the tail sees from the start.
3. Browse/stream for a minute so `stat` heartbeats and `close` summaries accumulate, then turn `DEBUG` back off.

**What the numbers tell you:** high `ttfb_ms`/`dial_ms` with low `rtt_ms` → slow *upstream* dial (try a different `PROXYIP`); high `rtt_ms` → the client↔Cloudflare leg is the bottleneck, not the Worker; many `fallback` events → direct is being censored (expected in Iran — ProxyIP is doing its job); `close` with `expected:false` → real resets worth investigating; low `active_down_bps` on big downloads → a throughput knob to tune; non-zero `q_max_*` near the caps → the upload queue is the limiter. Paste a batch of these JSON lines to an AI and it can reason about concrete tuning changes.

**Privacy note:** these logs contain your client IP and every destination host/IP. They're your own single-user traffic, but if you paste them to an external AI, be aware you're sharing your browsing destinations.

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
