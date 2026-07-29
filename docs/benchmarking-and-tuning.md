# Benchmarking and tuning workflow

This project tunes speed and reliability from live measurements, not guesses. Run the same suite before and after each change, then keep only changes that improve the measured result without hurting reliability.

## What the benchmarks measure

- `latency`: small plain-HTTP request through the tunnel. This models fast page opens and API calls.
- `burst`: concurrent small requests. This models Telegram-style bursts and busy browsing.
- `https`: real inner TLS over the tunnel. This models actual HTTPS browsing and video site opens.
- `download`: deterministic response from the benchmark target. This measures sustained downlink.
- `upload`: deterministic POST body to the benchmark target. This measures sustained uplink.

`latency`, `burst`, `download`, and `upload` can compare `grpc`, `ws`, and `xhttp`. The current `https` benchmark is gRPC-only because it uses a gRPC virtual socket for the inner TLS handshake. If you benchmark multiple transports, the tuning report will warn that HTTPS real-browsing coverage is missing for `ws`/`xhttp`; treat those transports' results as plain HTTP and throughput signals until dedicated HTTPS socket benchmarks exist.

Primary metrics:

- `acceptRate`: the tunnel accepted the VLESS/gRPC request. This should be `1` before speed tuning.
- `successRate`: the inner request completed. This should be `1` before speed tuning.
- `firstByteP95Ms`: worst normal first-byte latency. High values feel like stalls.
- `tlsP95Ms`: inner HTTPS handshake latency. High values hurt real browsing.
- `totalP95Ms`: full small-response completion time.
- `firstByteJitterMs`, `tlsJitterMs`, `totalJitterMs`: p95-minus-p50 spread. High values mean inconsistent opens, which users feel as random stalls even if the average is fine.
- `throughputP50Mbps`: sustained download/upload speed.

## One-time benchmark target

Deploy the optional deterministic target:

```powershell
cd "path\to\edgetunnel"
npx wrangler deploy -c benchmarks/wrangler.benchmark-target.toml
```

Use the resulting target hostname as `--bench-target`.

## Baseline run

Use the custom Worker domain for gRPC. Replace the placeholders:

```powershell
npm run bench:suite -- `
  --url https://YOUR-WORKER-DOMAIN/ `
  --uuid YOUR-UUID `
  --front-hosts www.modrinth.com,sourceforge.net,udemy.com `
  --transports grpc,ws,xhttp `
  --sni YOUR-WORKER-DOMAIN `
  --authority YOUR-WORKER-DOMAIN `
  --service-name / `
  --http-target neverssl.com `
  --https-target example.com `
  --bench-target YOUR-BENCH-TARGET `
  --prefix baseline `
  --label baseline `
  --runs 30 `
  --https-runs 10 `
  --throughput-runs 10
```

Then produce the tuning report:

```powershell
npm run bench:tune -- benchmark-runs/baseline-suite.json benchmark-runs/baseline-latency-burst.json benchmark-runs/baseline-https.json benchmark-runs/baseline-download.json benchmark-runs/baseline-upload.json --out benchmark-runs/baseline-tuning.json
```

Create a safe one-variable candidate plan:

```powershell
npm run bench:plan -- benchmark-runs/baseline-tuning.json --out benchmark-runs/baseline-plan.json
```

If the plan says `blocked`, do not tune Worker variables yet. Fix the stated evidence problem first: reliability below 100%, too few samples, or missing core `latency`/`burst`/`https` coverage.

## Candidate run

Change one thing only, deploy, then rerun with a candidate label. The plan output gives exact env values and command templates. Example:

```powershell
npm run bench:suite -- `
  --url https://YOUR-WORKER-DOMAIN/ `
  --uuid YOUR-UUID `
  --front-hosts www.modrinth.com,sourceforge.net,udemy.com `
  --transports grpc,ws,xhttp `
  --sni YOUR-WORKER-DOMAIN `
  --authority YOUR-WORKER-DOMAIN `
  --service-name / `
  --http-target neverssl.com `
  --https-target example.com `
  --bench-target YOUR-BENCH-TARGET `
  --prefix candidate-grain-64k `
  --label candidate-grain-64k `
  --runs 30 `
  --https-runs 10 `
  --throughput-runs 10
```

Compare matching reports:

```powershell
npm run bench:compare -- --baseline benchmark-runs/baseline-suite.json --candidate benchmark-runs/candidate-grain-64k-suite.json
npm run bench:compare -- --baseline benchmark-runs/baseline-latency-burst.json --candidate benchmark-runs/candidate-grain-64k-latency-burst.json
npm run bench:compare -- --baseline benchmark-runs/baseline-https.json --candidate benchmark-runs/candidate-grain-64k-https.json
npm run bench:compare -- --baseline benchmark-runs/baseline-download.json --candidate benchmark-runs/candidate-grain-64k-download.json
npm run bench:compare -- --baseline benchmark-runs/baseline-upload.json --candidate benchmark-runs/candidate-grain-64k-upload.json
```

The suite-to-suite compare is the main gate. The individual matrix compares are useful when you want to inspect latency/burst, HTTPS, download, and upload separately.

`bench:compare` fails when suite metadata differs, including front-host set, transport list, or HTTP/HTTPS/benchmark targets. Standalone matrix reports also carry and compare their profile list, front-host set, transport list, target, and port. This is intentional: changing targets between baseline and candidate can make a Worker tuning change look faster or slower for the wrong reason.

It also fails when zero matching scenarios are compared. A passing compare must mean at least one matching profile/transport/front-host scenario was actually evaluated.

## Tuning order

1. Fix `acceptRate` and `successRate` first. If either is below `1`, test front hosts/IPs before Worker tuning.
2. Compare transports with `--transports grpc,ws,xhttp` for latency, burst, download, and upload. The suite's `https` profile uses the gRPC inner-TLS benchmark, so use it as the gRPC real-browsing signal.
3. Choose front hosts by `burst` and `https`, not only `latency`. Bursty traffic and real TLS matter most for how the VPN feels.
4. Generate a candidate plan with `npm run bench:plan -- benchmark-runs/baseline-tuning.json`.
5. Tune source/env knobs one at a time:
   - `CONNECT_TIMEOUT_MS`
   - `DIAL_STAGGER_MS`
   - `DOWNLINK_GRAIN_PACKET_BYTES`
   - `DOWNLINK_BACKPRESSURE_HWM_BYTES`
   - `UPLINK_BUNDLE_TARGET_BYTES`
6. Keep a change only if comparator output passes and the tuning report has no new critical/high reliability or data-quality warning.

## Interpreting recommendations

- `reliability`: do not tune speed yet; the front/transport/target is unstable.
- `latency`: first-byte stalls are high; compare front hosts and connection timeout/stagger settings.
- `https-browsing`: real website TLS opens slowly; prioritize the front host with lower `tlsP95Ms`.
- `jitter`: p95-minus-p50 spread is high; prefer steadier front hosts/transports before tuning buffers.
- `throughput`: sustained speed is low; use the benchmark target and test buffer/grain settings after reliability is stable.
- `data-quality`: more samples are needed before trusting the result.
- `coverage`: add missing profiles before making tuning decisions.
