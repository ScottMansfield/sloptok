#!/usr/bin/env bash
set -euo pipefail
: "${SLOP_BUCKET:?set SLOP_BUCKET}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
gsutil -m rsync -r "${ROOT}/data/clips" "gs://${SLOP_BUCKET}/clips"
