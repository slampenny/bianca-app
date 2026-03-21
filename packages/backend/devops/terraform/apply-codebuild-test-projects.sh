#!/usr/bin/env bash
# Apply only the CodeBuild test projects (RunTests env vars: BIANCA_ECR_IMAGE_TAG, etc.)
# Uses AWS profile "jordan" (Bianca account 730335291008).
set -euo pipefail
cd "$(dirname "$0")"

export AWS_PROFILE="${AWS_PROFILE:-jordan}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-2}"

echo "Using AWS profile: $AWS_PROFILE (override with AWS_PROFILE=...)"
aws sts get-caller-identity --profile "$AWS_PROFILE"

terraform init -input=false -backend-config=backend-config.hcl

terraform apply -input=false -auto-approve \
  -var="aws_profile=${AWS_PROFILE}" \
  -target=aws_codebuild_project.production_tests \
  -target=aws_codebuild_project.staging_tests

echo "Done."
