# Cloud Run + Cloud CDN

The Cloud Run **service is HTTP only**. It never polls fal. Scheduler POSTs `/internal/refill` every 30 minutes with OIDC: submit one H3 job with webhookUrl, return 202. fal POSTs `/internal/fal-webhook` when done.

Env (do not commit values): `FAL_KEY`, `SLOP_BUCKET`, `CDN_BASE_URL`, `SLOP_PUBLIC_URL`, `WEBHOOK_SECRET`.

Seed clips: `gsutil rsync data/clips gs://$SLOP_BUCKET/clips` or `./scripts/sync-gcs.sh`.

Backend bucket + Cloud CDN so the browser plays `${CDN_BASE_URL}/clips/{file}`.

```bash
gcloud scheduler jobs create http sloptok-refill \\
  --location="${REGION}" \\
  --schedule="every 30 minutes" \\
  --time-zone="America/Los_Angeles" \\
  --uri="${SLOP_PUBLIC_URL}/internal/refill" \\
  --http-method=POST \\
  --oidc-service-account-email="sloptok-scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \\
  --oidc-token-audience="${SLOP_PUBLIC_URL}"
```

See `service.yaml` and `scheduler.yaml`. Mp4s are not in the Docker image.
