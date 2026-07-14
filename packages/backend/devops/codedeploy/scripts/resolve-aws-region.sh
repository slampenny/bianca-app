#!/bin/bash
# Resolve AWS region for CodeDeploy hooks / SSM deploy scripts on EC2.
# CodeBuild pushes images to the pipeline region (ca-central-1). Hardcoding us-east-2
# causes production to pull stale images that never receive new admin/backend builds.
#
# Must be safe to `source` under `set -euo pipefail` (grep miss must not abort).

_region_from_file=""
if [ -f /etc/environment ]; then
  # grep exits 1 when no match — do not fail the caller under pipefail/set -e
  _region_from_file=$(grep "^AWS_REGION=" /etc/environment 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs || true)
  if [ -n "${_region_from_file:-}" ]; then
    AWS_REGION="$_region_from_file"
  fi
fi

if [ -z "${AWS_REGION:-}" ] && command -v curl >/dev/null 2>&1; then
  _meta_region=$(curl -s --connect-timeout 1 http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || true)
  if [ -n "${_meta_region:-}" ]; then
    AWS_REGION="$_meta_region"
  fi
fi

AWS_REGION="${AWS_REGION:-ca-central-1}"
export AWS_REGION
