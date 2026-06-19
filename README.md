# edgetunnel

This repository contains a Cloudflare Worker / Pages deployment with an admin panel, subscription generation, and configurable transport settings.

## Quick Start

1. Create a Cloudflare Worker or Pages project.
2. Set an `ADMIN` environment variable. This is the admin panel password.
3. Bind a KV namespace using the binding name `KV`.
4. Deploy `_worker.js`.
5. Open `/admin` on your deployed domain and sign in with the admin password.

## Source And Build

`src/worker.js` is the source of truth. `_worker.js` is the generated deployable Worker file for Wrangler or manual copy-paste deployment.

```bash
npm run build
npm run verify-generated
npm test
npm run check
npm run bench:live -- --help
npm run bench:https -- --help
npm run bench:matrix -- --help
npm run bench:suite -- --help
npm run bench:analyze -- --help
npm run bench:compare -- --help
```

Edit user-facing static defaults in `src/core/config.js`, then run `npm run build`.

## Worker Deployment

1. Create a new Cloudflare Worker.
2. Copy the contents of `_worker.js` into the Worker editor, or deploy with Wrangler.
3. Add the `ADMIN` environment variable.
4. Add a KV namespace binding named `KV`.
5. Optional: add a custom domain from the Worker triggers page.

## Pages Deployment

1. Create a Cloudflare Pages project.
2. Upload the project files or connect this repository.
3. Add the `ADMIN` environment variable for production.
4. Add a KV namespace binding named `KV`.
5. Redeploy after setting the environment variables and bindings.

## Environment Variables

| Name | Required | Example | Description |
| --- | --- | --- | --- |
| `ADMIN` | Yes | `change-me` | Password for the admin panel. |
| `KEY` | No | `quick-link-key` | Optional quick subscription path key. |
| `UUID` | No | `90cd4a77-141a-43c9-991b-08263cfe9c10` | Optional fixed UUID. Must be UUID v4. |
| `HOST` | No | `example.com` | Optional explicit host list for generated links. |
| `PROXYIP` | No | `proxy.example.com:443` | Optional proxy endpoint. |
| `URL` | No | `https://example.com` | Optional fallback home page URL. |
| `GO2SOCKS5` | No | `*.example.com` | Optional list of host patterns routed through SOCKS5. |
| `DEBUG` | No | `1` | Enables debug logging when set to `1` or `true`. |
| `ENABLE_KV_LOG` | No | `1` | Opts in to KV request log writes. Disabled by default to protect KV free-tier write quota. |
| `OFF_LOG` | No | `1` | Legacy force-disable for KV request log writes. Takes priority over `ENABLE_KV_LOG`. |
| `LOG_TTL_DAYS` | No | `7` | Number of days to retain append-only KV request log entries. Clamped from 1 to 30 days. |
| `LOG_READ_LIMIT` | No | `500` | Maximum number of recent request logs returned by `/admin/log.json`. Clamped from 1 to 1000. |
| `ENABLE_KV_PROXY_CACHE` | No | `1` | Persistent KV proxy-resolution cache. On by default; writes are globally throttled and TTL'd so they cannot exhaust the free-plan KV write quota or drop connections. Set to `0` to disable. |
| `OFF_PROXY_CACHE` | No | `1` | Force-disables the persistent KV proxy-resolution cache (the in-memory cache stays on). |
| `BEST_SUB` | No | `1` | Enables preferred subscription generator mode when set to `1` or `true`. |
| `PRELOAD_RACE_DIAL` | No | `1` | Enables preload race dialing when set to `1` or `true`. |
| `CONNECT_TIMEOUT_MS` | No | `850` | Optional outbound connect timeout. Values are clamped from `400` to `1500` ms. |
| `DNS_TIMEOUT_MS` | No | `1200` | Optional DNS-over-TCP response timeout. Falls back to `CONNECT_TIMEOUT_MS` when set, otherwise `1200` ms. Values are clamped from `400` to `1500` ms. |
| `DIAL_STAGGER_MS` | No | `90` | Optional stagger between clean-IP/proxy candidate dials. Defaults to `90` ms and is clamped from `0` to `500` ms. |
| `DNS_SERVER` | No | `1.1.1.1:53` | Optional TCP DNS upstream for tunneled UDP DNS requests. Defaults to `8.8.4.4:53`. |
| `DOH_URL` | No | `https://dns.google/dns-query` | Optional DoH endpoint for preload race dialing and proxy-domain resolution. Defaults to Cloudflare DoH. |
| `FORCE_PROXY_HOSTS` | No | none | Optional comma/newline list of target host patterns that should skip direct dialing and go straight through ProxyIP or the configured chain proxy. Useful for Cloudflare-hosted panel/custom domains that return 5xx when reached from a Worker egress path. Unset by default. |

## Admin Panel

Open:

```text
https://your-domain.example/admin
```

Use the `ADMIN` password to sign in. The panel can update runtime configuration, view logs, and generate subscription links.

## Notes

- Keep the KV binding name as `KV`.
- Use a UUID v4 value when setting `UUID`.
- Redeploy after changing production environment variables.
- The generated subscription host defaults to the current deployed hostname unless `HOST` is explicitly configured.
- Proxy endpoint resolution uses a bounded memory cache plus a persistent last-known-good KV cache (on by default). KV writes are globally throttled (at most one every few minutes per isolate) and expire via TTL, so active browsing cannot exhaust the free-plan KV write quota; a write failure is always swallowed and never drops a connection. Set `OFF_PROXY_CACHE=1` or `ENABLE_KV_PROXY_CACHE=0` to keep it memory-only.
- Request logging is off by default to avoid exhausting Cloudflare's free-tier KV write quota during subscription traffic. Set `ENABLE_KV_LOG=1` to store append-only KV entries under `log:entry:`; existing legacy `log.json` data is still readable as a fallback when no append-only entries exist.
- `PRELOAD_RACE_DIAL=1` can improve first-open latency when DoH is fast and nearby, but it adds a DoH lookup before dialing each new hostname. Leave it off on networks where DoH is slow or blocked.
- TCP outbound dialing currently uses the request `fetcher.connect` adapter provided by the deployed runtime. Cloudflare's documented Workers socket API is `connect()` from `cloudflare:sockets`; migrate that adapter only after validating it in the same deployment target because the current path is known to work in this project.
- gRPC flush timing should be tuned only from measurements. Use `node scripts/grpc-live-smoke-benchmark.mjs --url https://your-domain.example/ --uuid your-vless-uuid` to smoke-test a deployed gRPC endpoint before changing batching constants.
- Use `node scripts/live-tunnel-benchmark.mjs --url https://your-domain.example/ --uuid your-vless-uuid --transports all --runs 5` to compare deployed WS, gRPC, and XHTTP first-byte latency, total time, and success rate before tuning speed-related defaults.

## Post-Deploy Benchmark Runbook

Run benchmarks only against the deployed Worker or custom domain you actually use. For gRPC, a custom domain is usually required. `--url`, `--sni`, and `--authority` should normally be the Worker/custom domain identity, while `--front-host` is the clean/front domain being tested.

Full baseline suite:

```bash
node scripts/run-benchmark-suite.mjs --url https://your-domain.example/ --uuid your-vless-uuid --front-hosts sourceforge.net,www.modrinth.com,www.speedtest.net --sni your-domain.example --authority your-domain.example --bench-target your-benchmark-target.example --out-dir benchmark-runs --prefix baseline
```

This writes separate reports for latency/burst and HTTPS, and includes download/upload runs when `--bench-target` is provided.

Latency and front-host stability:

```bash
node scripts/live-tunnel-benchmark.mjs --url https://your-domain.example/ --uuid your-vless-uuid --transports grpc --runs 30 --front-host sourceforge.net --sni your-domain.example --authority your-domain.example --service-name / --target neverssl.com --port 80 --profile latency
```

Burst behavior for Telegram/reel-style request fan-out:

```bash
node scripts/live-tunnel-benchmark.mjs --url https://your-domain.example/ --uuid your-vless-uuid --transports grpc --runs 24 --concurrency 6 --front-host sourceforge.net --sni your-domain.example --authority your-domain.example --service-name / --target neverssl.com --port 80 --profile burst
```

Real HTTPS browsing behavior:

```bash
node scripts/live-https-benchmark.mjs --url https://your-domain.example/ --uuid your-vless-uuid --runs 10 --front-host sourceforge.net --sni your-domain.example --authority your-domain.example --service-name / --target example.com --port 443 --path /
```

This performs an inner TLS handshake through the gRPC tunnel and reports `tlsP50Ms` / `tlsP95Ms` in addition to first-byte and total time.

To compare several front hosts with the same settings and save a baseline report:

```bash
node scripts/live-benchmark-matrix.mjs --url https://your-domain.example/ --uuid your-vless-uuid --transports grpc --front-hosts sourceforge.net,www.modrinth.com,www.speedtest.net --profiles latency,burst --runs 30 --sni your-domain.example --authority your-domain.example --service-name / --target neverssl.com --port 80 --out benchmark-baseline.json
```

For real HTTPS front-host comparison, run a separate matrix with an HTTPS target and port `443`:

```bash
node scripts/live-benchmark-matrix.mjs --url https://your-domain.example/ --uuid your-vless-uuid --transports grpc --front-hosts sourceforge.net,www.modrinth.com,www.speedtest.net --profiles https --runs 10 --sni your-domain.example --authority your-domain.example --service-name / --target example.com --port 443 --out benchmark-https-baseline.json
```

Analyze a saved benchmark report before tuning:

```bash
node scripts/analyze-benchmark-report.mjs benchmark-baseline.json --min-runs 10
```

After changing one tuning knob, run the same matrix again with a new output file and compare:

```bash
node scripts/compare-benchmark-reports.mjs --baseline benchmark-baseline.json --candidate benchmark-candidate.json
```

Download and upload profiles need a plain HTTP endpoint that serves or accepts the requested payload. The current script sends inner plain HTTP through the tunnel; `--port 80` is the inner destination port, not the outer Worker HTTPS port.

For cleaner throughput measurements, deploy the optional benchmark target Worker in `benchmarks/` and use its hostname as `--target`.

```bash
node scripts/live-tunnel-benchmark.mjs --url https://your-domain.example/ --uuid your-vless-uuid --transports grpc --runs 10 --front-host sourceforge.net --sni your-domain.example --authority your-domain.example --service-name / --target speedtest.tele2.net --port 80 --http-path /1MB.zip --profile download --timeout 30000
node scripts/live-tunnel-benchmark.mjs --url https://your-domain.example/ --uuid your-vless-uuid --transports grpc --runs 10 --front-host sourceforge.net --sni your-domain.example --authority your-domain.example --service-name / --target httpbin.org --port 80 --http-method POST --body-bytes 1048576 --profile upload --timeout 30000
```

Interpret the result this way:

- `acceptRate` proves the Worker accepted and decoded the tunnel protocol.
- `successRate` proves the inner HTTP response looked valid.
- `firstByteP50Ms` and `firstByteP95Ms` show instant-open latency and jitter.
- `totalP50Ms` and `totalP95Ms` show completion time for the chosen payload.
- `throughputP50Mbps` is useful only for download/upload profiles with meaningful payload sizes.
- Do not tune `DIAL_STAGGER_MS`, DNS preload, queue limits, or gRPC flush settings from a single small-response latency run.
- Treat analyzer `FAIL` signals as blockers for speed tuning. Fix reliability, target selection, or front-host choice first.
- Treat comparator failures as rollback signals unless the failed metric is unrelated to the knob being tested and you intentionally accept that tradeoff.

## Disclaimer

Use this project only where you have permission and where your use complies with applicable laws, Cloudflare terms, and network policies. You are responsible for your deployment and configuration.
