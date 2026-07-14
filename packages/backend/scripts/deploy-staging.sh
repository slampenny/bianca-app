#!/bin/bash
# Staging deploy — CodePipeline removed. Use yarn staging:deploy.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
echo "Staging CodePipeline has been removed."
echo "Use: yarn staging:deploy"
echo "  (build :staging → ECR ca-central-1 → SSM regenerate-host-stack → compose up → smoke)"
exec bash "$ROOT/packages/backend/scripts/staging-deploy.sh" "$@"
