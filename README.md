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
| `OFF_LOG` | No | `1` | Disables request logging when set to `1` or `true`. |
| `LOG_TTL_DAYS` | No | `7` | Number of days to retain append-only KV request log entries. Clamped from 1 to 30 days. |
| `LOG_READ_LIMIT` | No | `500` | Maximum number of recent request logs returned by `/admin/log.json`. Clamped from 1 to 1000. |
| `BEST_SUB` | No | `1` | Enables preferred subscription generator mode when set to `1` or `true`. |
| `PRELOAD_RACE_DIAL` | No | `1` | Enables preload race dialing when set to `1` or `true`. |
| `CONNECT_TIMEOUT_MS` | No | `850` | Optional outbound connect timeout. Values are clamped from `400` to `1500` ms. |
| `DNS_TIMEOUT_MS` | No | `1200` | Optional DNS-over-TCP response timeout. Falls back to `CONNECT_TIMEOUT_MS` when set, otherwise `1200` ms. Values are clamped from `400` to `1500` ms. |

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
- Proxy endpoint resolution uses a bounded memory cache and, when KV is bound, a small last-known-good KV cache. This keeps cold starts faster without allowing cache growth to become unbounded.
- Request logs are stored as append-only KV entries under `log:entry:` instead of one shared `log.json` blob. This avoids lost log writes under concurrent traffic. Existing legacy `log.json` data is still readable as a fallback when no append-only entries exist.
- TCP outbound dialing currently uses the request `fetcher.connect` adapter provided by the deployed runtime. Cloudflare's documented Workers socket API is `connect()` from `cloudflare:sockets`; migrate that adapter only after validating it in the same deployment target because the current path is known to work in this project.

## Disclaimer

Use this project only where you have permission and where your use complies with applicable laws, Cloudflare terms, and network policies. You are responsible for your deployment and configuration.
