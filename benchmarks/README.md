# Benchmark Target Worker

This optional Worker gives the tunnel benchmark a deterministic target for download and upload tests. It is separate from the tunnel Worker and should be deployed as its own Cloudflare Worker.

## Deploy

From this folder:

```bash
npx wrangler deploy -c wrangler.benchmark-target.toml
```

After deployment, open:

```text
https://your-target.example/health
```

Expected response:

```json
{
  "ok": true,
  "name": "edgetunnel benchmark target"
}
```

## Endpoints

- `/health` returns a small JSON health response.
- `/bytes/1048576` streams exactly 1 MiB of deterministic bytes.
- `/bytes?size=1048576` is the same endpoint using a query parameter.
- `/sink` reads the request body and returns how many bytes arrived.

Responses use `cache-control: no-store` so Cloudflare cache should not hide tunnel throughput.

## Use With The Tunnel Benchmark

Replace `bench-target.example` with the benchmark target hostname. The live tunnel benchmark currently sends inner plain HTTP, so use `--port 80` for this target.

Download:

```bash
node ../scripts/live-tunnel-benchmark.mjs --url https://your-tunnel.example/ --uuid your-vless-uuid --transports grpc --front-host sourceforge.net --sni your-tunnel.example --authority your-tunnel.example --service-name / --target bench-target.example --port 80 --http-path /bytes/1048576 --profile download --runs 10 --timeout 30000
```

Upload:

```bash
node ../scripts/live-tunnel-benchmark.mjs --url https://your-tunnel.example/ --uuid your-vless-uuid --transports grpc --front-host sourceforge.net --sni your-tunnel.example --authority your-tunnel.example --service-name / --target bench-target.example --port 80 --http-method POST --http-path /sink --body-bytes 1048576 --profile upload --runs 10 --timeout 30000
```

Use 1 MiB first. Then try 4 MiB and 8 MiB only after success rate stays at `1`.

For the full baseline/candidate workflow and tuning report commands, see `../docs/benchmarking-and-tuning.md`.
