#!/usr/bin/env bash
# Seed clip mp4s live in git under data/clips. They are NOT copied into the
# Docker image. Sync them into the CDN origin bucket.
set -euo pipefail

: "${SLOP_BUCKET:?set SLOP_BUCKET to the GCS bucket name (no gs:// prefix)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/data/clips"
DEST="gs://${SLOP_BUCKET}/clips"

if ! command -v gsutil >/dev/null 2>&1; then
  echo "gsutil is required" >&2
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "missing $SRC" >&2
  exit 1
fi

echo "rsync $SRC -> $DEST"
gsutil -m rsync -r "$SRC" "$DEST"
echo "done"
