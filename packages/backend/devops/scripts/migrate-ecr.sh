#!/usr/bin/env bash
# Seed ca-central-1 ECR with images copied from us-east-2.
# Creates repos if missing, pulls latest from source, re-tags, and pushes.
# Skips asterisk (decommissioned). Does NOT delete or modify us-east-2 repos.
#
# Usage:
#   AWS_PROFILE=jordan ./devops/scripts/migrate-ecr.sh
#
# Optional env vars:
#   AWS_ACCOUNT_ID  (default: 730335291008)
#   SOURCE_REGION   (default: us-east-2)
#   DEST_REGION     (default: ca-central-1)
#   IMAGE_TAG       (default: latest — also copies :production if present)
#   AWS_PROFILE     (default: jordan)

set -euo pipefail

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-730335291008}"
SOURCE_REGION="${SOURCE_REGION:-us-east-2}"
DEST_REGION="${DEST_REGION:-ca-central-1}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_PROFILE="${AWS_PROFILE:-jordan}"

export AWS_PROFILE

# repo_name -> used for both source and destination (same name, different region)
REPOS=(
  "bianca-app-backend"
  "bianca-app-frontend"
  "bianca-app-admin"
)

SOURCE_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${SOURCE_REGION}.amazonaws.com"
DEST_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${DEST_REGION}.amazonaws.com"

echo "=== ECR migration: ${SOURCE_REGION} → ${DEST_REGION} ==="
echo "Account: ${AWS_ACCOUNT_ID}"
echo "Profile: ${AWS_PROFILE}"
echo

echo "Logging in to ECR (${SOURCE_REGION} and ${DEST_REGION})..."
aws ecr get-login-password --region "${SOURCE_REGION}" \
  | docker login --username AWS --password-stdin "${SOURCE_REGISTRY}"
aws ecr get-login-password --region "${DEST_REGION}" \
  | docker login --username AWS --password-stdin "${DEST_REGISTRY}"
echo

for REPO in "${REPOS[@]}"; do
  echo "--- ${REPO} ---"

  if ! aws ecr describe-repositories --repository-names "${REPO}" --region "${DEST_REGION}" >/dev/null 2>&1; then
    echo "Creating ECR repository ${REPO} in ${DEST_REGION}..."
    aws ecr create-repository \
      --repository-name "${REPO}" \
      --region "${DEST_REGION}" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability MUTABLE \
      --tags "Key=Name,Value=${REPO}" "Key=ManagedBy,Value=migrate-ecr.sh"
  else
    echo "Repository already exists in ${DEST_REGION}: ${REPO}"
  fi

  SOURCE_IMAGE="${SOURCE_REGISTRY}/${REPO}:${IMAGE_TAG}"
  DEST_IMAGE="${DEST_REGISTRY}/${REPO}:${IMAGE_TAG}"

  echo "Pulling ${SOURCE_IMAGE}..."
  if ! docker pull "${SOURCE_IMAGE}"; then
    echo "ERROR: Could not pull ${SOURCE_IMAGE}" >&2
    echo "       Ensure the tag exists in ${SOURCE_REGION} (try IMAGE_TAG=production)." >&2
    exit 1
  fi

  echo "Tagging and pushing ${DEST_IMAGE}..."
  docker tag "${SOURCE_IMAGE}" "${DEST_IMAGE}"
  docker push "${DEST_IMAGE}"

  # Production deploys often use :production — copy when present and distinct from IMAGE_TAG.
  if [ "${IMAGE_TAG}" != "production" ]; then
    PROD_SOURCE="${SOURCE_REGISTRY}/${REPO}:production"
    PROD_DEST="${DEST_REGISTRY}/${REPO}:production"
    if docker pull "${PROD_SOURCE}" 2>/dev/null; then
      echo "Also copying :production tag..."
      docker tag "${PROD_SOURCE}" "${PROD_DEST}"
      docker push "${PROD_DEST}"
    else
      echo "No :production tag in source (skipped)."
    fi
  fi

  echo "Done: ${DEST_REGISTRY}/${REPO}"
  echo
done

cat <<EOF
=== New ECR repository URLs (${DEST_REGION}) ===

  App (backend):  ${DEST_REGISTRY}/bianca-app-backend
  Frontend:       ${DEST_REGISTRY}/bianca-app-frontend
  Admin:          ${DEST_REGISTRY}/bianca-app-admin

Use these in Terraform (var.aws_region = ${DEST_REGION}), CodeDeploy, and docker-compose:
  ${DEST_REGISTRY}/bianca-app-backend:production
  ${DEST_REGISTRY}/bianca-app-frontend:production
  ${DEST_REGISTRY}/bianca-app-admin:latest

us-east-2 repositories were not modified.

EOF
