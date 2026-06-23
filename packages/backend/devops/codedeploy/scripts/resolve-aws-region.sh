#!/bin/bash
# Resolve AWS region for CodeDeploy hooks on EC2.
# CodeBuild pushes images to the pipeline region (ca-central-1). Hardcoding us-east-2
# causes production to pull stale images that never receive new admin/backend builds.

if [ -f /etc/environment ]; then
  _region_from_file=$(grep "^AWS_REGION=" /etc/environment 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
  if [ -n "$_region_from_file" ]; then
    AWS_REGION="$_region_from_file"
  fi
fi

if [ -z "${AWS_REGION:-}" ] && command -v curl >/dev/null 2>&1; then
  _meta_region=$(curl -s --connect-timeout 1 http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo "")
  if [ -n "$_meta_region" ]; then
    AWS_REGION="$_meta_region"
  fi
fi

AWS_REGION="${AWS_REGION:-ca-central-1}"
export AWS_REGION
