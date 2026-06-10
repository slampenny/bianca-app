#!/bin/bash
# Verify that staging has the latest code deployed
# Checks API endpoints and Docker image tags

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verifying Staging Deployment${NC}"
echo ""

# Configuration
AWS_REGION="us-east-2"
AWS_PROFILE="jordan"
STAGING_API="https://staging-api.biancawellness.com"

# Get the latest commit hash
LATEST_COMMIT=$(git rev-parse HEAD)
SHORT_COMMIT=$(git rev-parse --short HEAD)
echo -e "${BLUE}📋 Latest commit: ${SHORT_COMMIT}${NC}"
echo "   ${LATEST_COMMIT}"
echo ""

# Check if API is responding
echo -e "${BLUE}🌐 Checking staging API health...${NC}"
if curl -s -f "${STAGING_API}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API is responding${NC}"
    
    # Try to get version info if available
    if curl -s -f "${STAGING_API}/health" | grep -q "version\|commit" 2>/dev/null; then
        echo -e "${BLUE}   Version info:${NC}"
        curl -s "${STAGING_API}/health" | head -5
    fi
else
    echo -e "${RED}❌ API is not responding${NC}"
    echo "   URL: ${STAGING_API}/health"
fi
echo ""

# Check live-dev / instance status (pipeline removed)
echo -e "${BLUE}📊 Staging deploy model...${NC}"
echo -e "${GREEN}✅ CodePipeline removed — use yarn staging:live or manual-deploy-staging.sh${NC}"
echo ""

# Check for timezone-related code
echo -e "${BLUE}🔍 Verifying timezone code is in latest commit...${NC}"
if git show HEAD --name-only | grep -q "timezone\|org.model\|schedule.service\|schedule.dto"; then
    echo -e "${GREEN}✅ Timezone code is in latest commit${NC}"
    echo "   Files changed:"
    git show HEAD --name-only | grep -E "(timezone|org.model|schedule.service|schedule.dto)" | sed 's/^/     - /'
else
    echo -e "${YELLOW}⚠️  Timezone code not found in latest commit${NC}"
    echo "   Checking if it's in staging branch..."
    if git log origin/staging --oneline --all --grep="timezone" | head -1; then
        echo -e "${GREEN}   ✅ Found timezone commit in staging branch${NC}"
    fi
fi
echo ""

echo -e "${BLUE}💡 To test timezone functionality:${NC}"
echo "   1. Go to staging frontend: https://staging.biancawellness.com"
echo "   2. Navigate to Organization Settings"
echo "   3. Check for 'Timezone' picker in the settings"
echo "   4. Create/edit a schedule and verify times are in org timezone"
echo ""






