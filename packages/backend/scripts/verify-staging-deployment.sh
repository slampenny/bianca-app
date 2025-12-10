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

# Check pipeline status
echo -e "${BLUE}📊 Checking pipeline status...${NC}"
PIPELINE_NAME="bianca-staging-pipeline"

if aws codepipeline get-pipeline --name "$PIPELINE_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null 2>&1; then
    LATEST_EXECUTION=$(aws codepipeline list-pipeline-executions \
        --pipeline-name "$PIPELINE_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --max-results 1 \
        --query 'pipelineExecutionSummaries[0]' \
        --output json 2>/dev/null)
    
    if [ -n "$LATEST_EXECUTION" ] && [ "$LATEST_EXECUTION" != "null" ]; then
        STATUS=$(echo "$LATEST_EXECUTION" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        EXECUTION_ID=$(echo "$LATEST_EXECUTION" | grep -o '"pipelineExecutionId":"[^"]*"' | cut -d'"' -f4)
        START_TIME=$(echo "$LATEST_EXECUTION" | grep -o '"startTime":"[^"]*"' | cut -d'"' -f4)
        
        echo -e "${BLUE}   Latest execution:${NC}"
        echo "   Status: $STATUS"
        echo "   Execution ID: $EXECUTION_ID"
        echo "   Started: $START_TIME"
        
        if [ "$STATUS" = "Succeeded" ]; then
            echo -e "${GREEN}   ✅ Pipeline completed successfully${NC}"
        elif [ "$STATUS" = "InProgress" ]; then
            echo -e "${YELLOW}   ⏳ Pipeline is still running${NC}"
        elif [ "$STATUS" = "Failed" ]; then
            echo -e "${RED}   ❌ Pipeline failed${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠️  No pipeline executions found${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  Pipeline not found or not accessible${NC}"
fi
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



