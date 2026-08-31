#!/usr/bin/env bash
# Thin wrapper. Fill PROJECT_ID REGION IMAGE SLOP_* then deploy.
# Cloud Run is HTTP only — never poll fal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${PROJECT_ID:?}"
: "${REGION:?}"
: "${IMAGE:?}"
gcloud builds submit --project "${PROJECT_ID}" --tag "${IMAGE}" "${ROOT}"
gcloud run services replace "${ROOT}/deploy/service.yaml" --project "${PROJECT_ID}" --region "${REGION}"
echo "Create/update Scheduler from deploy/scheduler.yaml or the gcloud command in deploy/README.md"
echo "Seed clips: SLOP_BUCKET=... ${ROOT}/scripts/sync-gcs.sh"
