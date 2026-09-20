# Verification Record

## Automated verification

Run from repository root:

```text
pnpm typecheck
pnpm test
pnpm build
```

Expected artifacts:

- `dist/manifest.js`;
- `dist/worker.js`.

Expected manifest identity:

- plugin ID: `zaruba.vans-web-tools`;
- version: `0.1.0`;
- tools: `vans_web_search`, `vans_web_fetch`.

## Live VansRouter smoke

```text
VANS_BASE_URL=http://127.0.0.1:20129 VANS_API_KEY=<секрет> node scripts/live-smoke.mjs
```

Smoke acceptance:

- search returns at least one result;
- fetch returns non-empty page content;
- serialized tool output does not contain the API key.

## Network negative checks

The plugin must reject before network dispatch:

- `http://127.0.0.1/`;
- `http://10.0.0.1/`;
- `http://169.254.169.254/latest/meta-data/`;
- `http://[::1]/`;
- non-HTTP(S) schemes;
- non-standard ports.

The live VansRouter fetch provider must independently reject loopback, RFC1918 and link-local metadata targets.

## Deployment boundary

Passing local verification does not mean production is changed. Installing or activating the plugin in Paperclip requires separate operator confirmation and a post-install agent smoke.
