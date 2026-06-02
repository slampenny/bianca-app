#!/bin/bash
# HIPAA MongoDB backup — runs on EC2 (mongodump via Docker, upload to encrypted S3).
# Usage: hipaa-backup.sh [daily|weekly|monthly|safety]

set -euo pipefail

BACKUP_TYPE="${1:-daily}"
ENV="${ENVIRONMENT:-staging}"
BUCKET="${HIPAA_BACKUP_BUCKET:-${ENV}-bianca-hipaa-backups}"
REGION="${AWS_REGION:-us-east-2}"
WORKDIR="/opt/bianca-${ENV}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
BACKUP_ID="backup-${TIMESTAMP}"
ARCHIVE="/tmp/${BACKUP_ID}.gz"
S3_KEY="${BACKUP_TYPE}/${BACKUP_ID}.gz"

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

echo "Starting ${BACKUP_TYPE} backup for ${ENV}..."
$DC exec -T mongodb mongodump --archive | gzip > "$ARCHIVE"

SIZE_BYTES="$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE")"
if [ "$SIZE_BYTES" -lt 100 ]; then
  echo "Backup archive too small (${SIZE_BYTES} bytes) — mongodump may have failed" >&2
  rm -f "$ARCHIVE"
  exit 1
fi

KMS_KEY_ID=""
if aws kms describe-key --key-id "alias/${ENV}-backup-encryption" --region "$REGION" >/dev/null 2>&1; then
  KMS_KEY_ID="$(aws kms describe-key --key-id "alias/${ENV}-backup-encryption" --region "$REGION" --query 'KeyMetadata.KeyId' --output text)"
fi

if [ -n "$KMS_KEY_ID" ]; then
  aws s3 cp "$ARCHIVE" "s3://${BUCKET}/${S3_KEY}" \
    --region "$REGION" \
    --sse aws:kms \
    --sse-kms-key-id "$KMS_KEY_ID" \
    --metadata "backup-type=${BACKUP_TYPE},environment=${ENV},hipaa-compliant=true,backup-size-bytes=${SIZE_BYTES}"
else
  aws s3 cp "$ARCHIVE" "s3://${BUCKET}/${S3_KEY}" \
    --region "$REGION" \
    --sse aws:kms \
    --metadata "backup-type=${BACKUP_TYPE},environment=${ENV},hipaa-compliant=true,backup-size-bytes=${SIZE_BYTES}"
fi

rm -f "$ARCHIVE"
echo "Uploaded s3://${BUCKET}/${S3_KEY} (${SIZE_BYTES} bytes)"
