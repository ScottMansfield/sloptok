# sloptok Worker (full Cloudflare stack)

Serves sloptok.dev as of 2026-10-11 ~11:36 PM PT. Replaces Next.js on Cloud Run and the `sloptok-proxy` Worker (kept only as rollback).

- `public/`: static site (vanilla JS). It loads `/feed.json` once and shuffles randomly on each visit. There are no seeded links.
- `src/index.js`: routing. `/feed.json` (and legacy `/api/feed`) are served from R2 `feed.json`. Also `/api/health`, the fal webhook, admin ops, and the cron.
- `src/catalog.js`: Durable Object `Catalog`, the **single writer** (SQLite). All refill/ingest calls are serialized, ingest is idempotent on fal `request_id`, and pending entries are cleared. After every change it publishes `feed.json` and `catalog/catalog.json` to R2.
- `src/fal-verify.js`: fal webhook ED25519 signature verification (JWKS, ±300 s). Unsigned or tampered deliveries get a 401. Only request_ids we submitted are ingested.
- Clips: R2 `sloptok-clips/clips/<id>.mp4`, served at `https://cdn.sloptok.dev/clips/<file>`.
- The original GCS `library.json` is archived at R2 `catalog/library-gcp-final.json`.

## Spend guards (all in the DO)
- `REFILL_ENABLED` (kill switch, default `"false"`): the cron does nothing unless it is `"true"`.
- `DAILY_GEN_CAP=24`, `MONTHLY_GEN_CAP=720` (rolling 24 h / 30 d), and `MAX_PENDING=1` in flight.
- Webhooks never submit new generations.
- Also set a spend limit in the fal.ai dashboard.

## Deploy
Requires Node >= 22.
```
cd worker
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy
printf %s "$FAL_KEY" | npx wrangler secret put FAL_KEY
printf %s "$ADMIN_TOKEN" | npx wrangler secret put ADMIN_TOKEN
```

## Admin (Authorization: Bearer ADMIN_TOKEN)
- `GET /internal/admin/state`
- `POST /internal/admin/refill-once`: obeys caps and the in-flight limit, but not the kill switch
- `POST /internal/admin/publish`
- `POST /internal/admin/seed`: one-time import, refused if the catalog is already seeded

## Rollback
Point the zone routes `sloptok.dev/*` and `www.sloptok.dev/*` back to the `sloptok-proxy` Worker (Cloud Run origin). Clips made since cutover exist only in R2/DO. Export `catalog/catalog.json` before rolling back if they matter.
