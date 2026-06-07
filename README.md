# edgetunnel

This repository contains a Cloudflare Worker / Pages deployment with an admin panel, subscription generation, and configurable transport settings.

## Quick Start

1. Create a Cloudflare Worker or Pages project.
2. Set an `ADMIN` environment variable. This is the admin panel password.
3. Bind a KV namespace using the binding name `KV`.
4. Deploy `_worker.js`.
5. Open `/admin` on your deployed domain and sign in with the admin password.

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
| `ENABLE_KV_PROXY_CACHE` | No | `1` | Opts in to persistent KV proxy-resolution cache reads and writes. The in-memory cache remains enabled either way. |
| `BEST_SUB` | No | `1` | Enables preferred subscription generator mode when set to `1` or `true`. |
| `PRELOAD_RACE_DIAL` | No | `1` | Enables preload race dialing when set to `1` or `true`. |
| `CONNECT_TIMEOUT_MS` | No | `850` | Optional outbound connect timeout. Values are clamped from `400` to `1500` ms. |
| `DNS_TIMEOUT_MS` | No | `1200` | Optional DNS-over-TCP response timeout. Falls back to `CONNECT_TIMEOUT_MS` when set, otherwise `1200` ms. Values are clamped from `400` to `1500` ms. |
| `DNS_SERVER` | No | `1.1.1.1:53` | Optional TCP DNS upstream for tunneled UDP DNS requests. Defaults to `8.8.4.4:53`. |
| `DOH_URL` | No | `https://dns.google/dns-query` | Optional DoH endpoint for preload race dialing and proxy-domain resolution. Defaults to Cloudflare DoH. |

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
- Proxy endpoint resolution uses a bounded memory cache by default. Set `ENABLE_KV_PROXY_CACHE=1` only if you want a persistent last-known-good KV cache across isolate resets.
- Request logging is off by default to avoid exhausting Cloudflare's free-tier KV write quota during subscription traffic. Set `ENABLE_KV_LOG=1` to store append-only KV entries under `log:entry:`; existing legacy `log.json` data is still readable as a fallback when no append-only entries exist.
- `PRELOAD_RACE_DIAL=1` can improve first-open latency when DoH is fast and nearby, but it adds a DoH lookup before dialing each new hostname. Leave it off on networks where DoH is slow or blocked.
- TCP outbound dialing currently uses the request `fetcher.connect` adapter provided by the deployed runtime. Cloudflare's documented Workers socket API is `connect()` from `cloudflare:sockets`; migrate that adapter only after validating it in the same deployment target because the current path is known to work in this project.
- gRPC flush timing should be tuned only from measurements. Use `node scripts/grpc-live-smoke-benchmark.mjs --url https://your-domain.example/ --uuid your-vless-uuid` to smoke-test a deployed gRPC endpoint before changing batching constants.

## Disclaimer

Use this project only where you have permission and where your use complies with applicable laws, Cloudflare terms, and network policies. You are responsible for your deployment and configuration.
