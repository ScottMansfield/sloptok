#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${PROJECT_ID:?}"
: "${REGION:?}"
: "${IMAGE:?}"
gcloud builds submit --project "${PROJECT_ID}" --tag "${IMAGE}" "${ROOT}"
gcloud run services replace "${ROOT}/deploy/service.yaml" --project "${PROJECT_ID}" --region "${REGION}"
