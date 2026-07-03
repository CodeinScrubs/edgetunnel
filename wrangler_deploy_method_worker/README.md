# Wrangler-deploy build

`_worker.js` in this folder is the **Wrangler-only** build of the worker. It is generated from
`../src/worker.js` by `npm run build` and is identical to `../_worker_copypaste.js` except that
outbound TCP uses the documented `connect()` from `cloudflare:sockets` instead of
`request.fetcher.connect`.

## Deploy

```bash
wrangler deploy -c wrangler_deploy_method_worker/wrangler.toml
```

Edit `wrangler.toml` first to set your worker `name`, KV namespace `id`, and (optionally) your
custom-domain route. See the comments in that file.

## Do not copy-paste this build

The Cloudflare Dashboard "Edit Code" editor mishandles the `cloudflare:sockets` import and the
worker returns **Error 1101**. For Dashboard copy-paste deployment use `../_worker_copypaste.js`
instead (it uses `request.fetcher.connect` and pastes cleanly).

## Regenerating

Do not edit `_worker.js` here by hand. Edit `../src/worker.js` (or `../src/core/config.js`) and run:

```bash
npm run build          # regenerates both builds
npm run verify-generated
```
