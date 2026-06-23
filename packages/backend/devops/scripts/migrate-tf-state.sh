#!/usr/bin/env bash
# Copy Terraform remote state from us-east-2 into a new ca-central-1 bucket.
# Does NOT modify the source bucket or any other us-east-2 resources.
#
# Usage:
#   AWS_PROFILE=jordan ./devops/scripts/migrate-tf-state.sh
#
# Optional env vars:
#   SOURCE_BUCKET   (default: bianca-terraform-state)
#   SOURCE_REGION   (default: us-east-2)
#   DEST_BUCKET     (default: bianca-terraform-state-ca-central-1)
#   DEST_REGION     (default: ca-central-1)
#   STATE_KEY       (default: backend/terraform.tfstate)
#   AWS_PROFILE     (default: jordan)

set -euo pipefail

SOURCE_BUCKET="${SOURCE_BUCKET:-bianca-terraform-state}"
SOURCE_REGION="${SOURCE_REGION:-us-east-2}"
DEST_BUCKET="${DEST_BUCKET:-bianca-terraform-state-ca-central-1}"
DEST_REGION="${DEST_REGION:-ca-central-1}"
STATE_KEY="${STATE_KEY:-backend/terraform.tfstate}"
AWS_PROFILE="${AWS_PROFILE:-jordan}"

export AWS_PROFILE

echo "=== Terraform state migration: ${SOURCE_REGION} → ${DEST_REGION} ==="
echo "Source: s3://${SOURCE_BUCKET}/${STATE_KEY} (${SOURCE_REGION})"
echo "Dest:   s3://${DEST_BUCKET}/${STATE_KEY} (${DEST_REGION})"
echo "Profile: ${AWS_PROFILE}"
echo

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "AWS account: ${ACCOUNT_ID}"
echo

if aws s3api head-bucket --bucket "${DEST_BUCKET}" --region "${DEST_REGION}" 2>/dev/null; then
  echo "Destination bucket already exists: ${DEST_BUCKET}"
else
  echo "Creating destination bucket ${DEST_BUCKET} in ${DEST_REGION}..."
  aws s3api create-bucket \
    --bucket "${DEST_BUCKET}" \
    --region "${DEST_REGION}" \
    --create-bucket-configuration "LocationConstraint=${DEST_REGION}"

  echo "Enabling versioning..."
  aws s3api put-bucket-versioning \
    --bucket "${DEST_BUCKET}" \
    --region "${DEST_REGION}" \
    --versioning-configuration Status=Enabled

  echo "Enabling SSE-S3 (AES256) encryption..."
  aws s3api put-bucket-encryption \
    --bucket "${DEST_BUCKET}" \
    --region "${DEST_REGION}" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" },
        "BucketKeyEnabled": true
      }]
    }'

  echo "Blocking public access..."
  aws s3api put-public-access-block \
    --bucket "${DEST_BUCKET}" \
    --region "${DEST_REGION}" \
    --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  echo "Destination bucket created."
fi

echo
echo "Syncing state objects from source to destination..."
# Sync the backend/ prefix (includes terraform.tfstate and any state backups).
aws s3 sync "s3://${SOURCE_BUCKET}/backend/" "s3://${DEST_BUCKET}/backend/" \
  --source-region "${SOURCE_REGION}" \
  --region "${DEST_REGION}"

echo
echo "Verifying destination object..."
aws s3api head-object \
  --bucket "${DEST_BUCKET}" \
  --key "${STATE_KEY}" \
  --region "${DEST_REGION}" >/dev/null
echo "OK: s3://${DEST_BUCKET}/${STATE_KEY} exists in ${DEST_REGION}"

cat <<EOF

=== Next steps (manual — not applied by this script) ===

1. Update Terraform backend configuration to point at the new bucket:

   packages/backend/devops/terraform/backend.tf
   ─────────────────────────────────────────────
   terraform {
     backend "s3" {
       bucket  = "${DEST_BUCKET}"
       key     = "${STATE_KEY}"
       region  = "${DEST_REGION}"
       encrypt = true
     }
   }

   packages/backend/devops/terraform/backend-config.hcl
   ────────────────────────────────────────────────────
   bucket  = "${DEST_BUCKET}"
   key     = "${STATE_KEY}"
   region  = "${DEST_REGION}"
   encrypt = true
   profile = "${AWS_PROFILE}"

2. Re-initialize Terraform against the new backend (read-only check):

   cd packages/backend/devops/terraform
   terraform init -reconfigure -backend-config=backend-config.hcl

3. Review the plan before any apply:

   terraform plan | tee ../terraform-ca-central-1-plan.txt

4. If you also use packages/mobile/devops/terraform/frontend-pipeline.tf,
   update its terraform_remote_state backend bucket/region to match.

The source bucket (s3://${SOURCE_BUCKET} in ${SOURCE_REGION}) is unchanged.
Remove or archive it only after ca-central-1 is fully validated.

EOF
