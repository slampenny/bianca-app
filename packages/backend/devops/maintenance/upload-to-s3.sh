#!/bin/bash
# Upload maintenance page to S3 bucket

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAINTENANCE_HTML="$SCRIPT_DIR/maintenance.html"
S3_BUCKET="${MAINTENANCE_S3_BUCKET:-bianca-maintenance-pages}"
AWS_REGION="${AWS_REGION:-us-east-2}"

if [ ! -f "$MAINTENANCE_HTML" ]; then
    echo "❌ ERROR: Maintenance HTML file not found: $MAINTENANCE_HTML"
    exit 1
fi

echo "📤 Uploading maintenance page to S3..."
echo "   Bucket: s3://$S3_BUCKET"
echo "   Region: $AWS_REGION"

# Create bucket if it doesn't exist (idempotent)
if ! aws s3 ls "s3://$S3_BUCKET" 2>&1 | grep -q "NoSuchBucket"; then
    echo "   Bucket exists, proceeding..."
else
    echo "   Creating bucket..."
    aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION" || {
        echo "   ⚠️  Could not create bucket (may already exist or permissions issue)"
    }
fi

# Upload maintenance page with public read access
aws s3 cp "$MAINTENANCE_HTML" "s3://$S3_BUCKET/maintenance.html" \
    --region "$AWS_REGION" \
    --content-type "text/html" \
    --acl public-read || {
    echo "❌ ERROR: Failed to upload maintenance page to S3"
    exit 1
}

echo "✅ Maintenance page uploaded successfully"
echo "   URL: https://$S3_BUCKET.s3.$AWS_REGION.amazonaws.com/maintenance.html"


