#!/bin/bash
# HIPAA MongoDB restore — runs on EC2 (download from S3, mongorestore via Docker).
# Usage: hipaa-restore.sh <s3-key> YES_I_WANT_TO_RESTORE

set -euo pipefail

S3_KEY="${1:-}"
CONFIRM="${2:-}"
ENV="${ENVIRONMENT:-staging}"
BUCKET="${HIPAA_BACKUP_BUCKET:-${ENV}-bianca-hipaa-backups}"
REGION="${AWS_REGION:-us-east-2}"
WORKDIR="/opt/bianca-${ENV}"

if [ -z "$S3_KEY" ]; then
  echo "Usage: hipaa-restore.sh <s3-key> YES_I_WANT_TO_RESTORE" >&2
  exit 1
fi

if [ "$CONFIRM" != "YES_I_WANT_TO_RESTORE" ]; then
  echo "Restore not confirmed — pass YES_I_WANT_TO_RESTORE as second argument" >&2
  exit 1
fi

if [ ! -d "$WORKDIR" ]; then
  echo "Deploy directory not found: $WORKDIR" >&2
  exit 1
fi

cd "$WORKDIR"

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "docker compose not available" >&2
  exit 1
fi

echo "Creating safety backup before restore..."
if [ -x "./hipaa-backup.sh" ]; then
  ./hipaa-backup.sh safety || echo "Warning: safety backup failed (continuing restore)"
fi

ARCHIVE="/tmp/restore-$(date +%s).gz"
aws s3 cp "s3://${BUCKET}/${S3_KEY}" "$ARCHIVE" --region "$REGION"

SIZE_BYTES="$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE")"
if [ "$SIZE_BYTES" -lt 100 ]; then
  echo "Downloaded backup too small (${SIZE_BYTES} bytes)" >&2
  rm -f "$ARCHIVE"
  exit 1
fi

echo "Restoring from s3://${BUCKET}/${S3_KEY} (${SIZE_BYTES} bytes)..."
gunzip -c "$ARCHIVE" | $DC exec -T mongodb mongorestore --archive --drop

rm -f "$ARCHIVE"
echo "Restore complete from s3://${BUCKET}/${S3_KEY}"
