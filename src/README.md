# Source Layout

`src/worker.js` is the source of truth for the deployable Worker.

Run `npm run build` to generate `_worker.js` for Cloudflare Worker editor or Wrangler deployment.

The first refactor pass keeps runtime behavior unchanged and starts extraction with the top editable config module. The folders below define the intended ownership for future behavior-preserving extraction slices.

