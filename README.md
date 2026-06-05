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
| `BEST_SUB` | No | `1` | Enables preferred subscription generator mode when set to `1` or `true`. |
| `PRELOAD_RACE_DIAL` | No | `1` | Enables preload race dialing when set to `1` or `true`. |

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

## Disclaimer

Use this project only where you have permission and where your use complies with applicable laws, Cloudflare terms, and network policies. You are responsible for your deployment and configuration.
