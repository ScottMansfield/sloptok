# Cloudflare hosting (cheap mode)

Since 2026-10-11 SlopTok is served via Cloudflare instead of the GCP HTTPS load balancer.

- `sloptok.dev/*`, `www.sloptok.dev/*` -> Worker `sloptok-proxy` (`worker.js`), which proxies to Cloud Run
  (`https://sloptok-tgn4jp474q-uc.a.run.app`), adds `X-Forwarded-Host`, and 301s www -> apex.
  DNS records for apex/www are proxied `AAAA 100::` placeholders.
- `cdn.sloptok.dev` -> R2 bucket `sloptok-clips` custom domain; clips at `clips/<file>.mp4`
  (Content-Type video/mp4, Cache-Control public, max-age=31536000, immutable).
- `library.json` still lives in GCS (`gs://sloptok-clips-grok-bot-506919`); GCS mp4s kept as backup.

## Deploy the Worker (no wrangler needed)
```
curl -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/sloptok-proxy \
  -F 'metadata={"main_module":"worker.js","compatibility_date":"2026-10-01"};type=application/json' \
  -F 'worker.js=@cloudflare/worker.js;type=application/javascript+module'
```
(`npx wrangler deploy` also works with Node >= 22.)

## Syncing new clips to R2
New fal clips land in GCS; copy them with rclone (S3 provider Cloudflare, endpoint
`https://$ACCOUNT_ID.r2.cloudflarestorage.com`, access key = API token id, secret = sha256(token)),
setting the Content-Type/Cache-Control headers above. Refill is currently paused.
