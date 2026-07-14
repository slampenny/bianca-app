#!/bin/bash
# Compatibility wrapper — prefer: yarn staging:deploy
# Pulls/rebuilds via packages/backend/scripts/staging-deploy.sh (ca-central-1 ECR + SSM).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "⚠️  manual-deploy-staging.sh now delegates to yarn staging:deploy"
echo "   (ca-central-1 ECR, SSM regenerate-host-stack, smoke checks)"
exec bash "$ROOT/packages/backend/scripts/staging-deploy.sh" "$@"
