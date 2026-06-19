#!/bin/bash
# Staging deploy — pipeline removed. Use live-dev sync or manual ECR refresh.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}Staging CodePipeline has been removed.${NC}"
echo ""
echo -e "${BLUE}Recommended — local edits sync to staging with hot reload:${NC}"
echo "  yarn staging:live"
echo ""
echo -e "${BLUE}Alternative — pull latest :staging images from ECR (no source sync):${NC}"
echo "  ./manual-deploy-staging.sh"
echo ""
echo -e "${BLUE}Instance control:${NC}"
echo "  yarn staging:up | yarn staging:down | yarn staging:status"
echo "  yarn staging:always-on   # pause idle auto-stop Lambda"
echo ""
exit 1
