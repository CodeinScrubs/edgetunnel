# Source Layout

`src/worker.js` is the source of truth for the deployable Worker.

Run `npm run build` to generate the two deployable builds: `_worker_copypaste.js` (Cloudflare Worker editor / Dashboard copy-paste, via `request.fetcher.connect`) and `wrangler_deploy_method_worker/_worker.js` (Wrangler deploy, via `cloudflare:sockets`).

The first refactor pass keeps runtime behavior unchanged and starts extraction with the top editable config module. The folders below define the intended ownership for future behavior-preserving extraction slices.

