# Admin

`admin-ui.js` is the self-contained English admin UI, served directly from the Worker
(login page, admin panel, ProxyIP scanner page, and notice pages). It is inlined into
`_worker.js` by `scripts/build-worker.mjs`, so there is no runtime dependency on any
external static-page host.

`renderEnglishAdminPage(config_JSON, host)` inlines the live config and POSTs the whole
object back to `/admin/config.json` on save, preserving every key (including the
mixed-language config keys) so the round-trip stays loss-free.

Rules:
- Visible admin UI text stays English; the only non-ASCII in the page is `\uXXXX`-escaped
  config keys inside the client script (decoded by the browser, never shown to the user).
- Keep the render functions dependency-free and pure (HTML in, string out) so the build can
  inline them.
- KV logging and the persistent proxy cache remain opt-out-safe; the UI must not introduce
  unthrottled KV writes.
