#!/bin/bash
# Script to reseed demo database on AWS (demo.biancawellness.com)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# AWS Configuration
AWS_PROFILE="jordan"
REGION="us-east-2"
DEMO_URL="https://demo.biancawellness.com"
API_URL="${DEMO_URL}/v1"
HEALTH_URL="${DEMO_URL}/health"

# Get demo instance ID
get_demo_instance_id() {
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=bianca-demo" "Name=instance-state-name,Values=running" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text \
        --profile $AWS_PROFILE \
        --region $REGION
}

echo -e "${BLUE}🌱 Reseeding demo database on AWS...${NC}"
echo -e "${YELLOW}📍 Demo URL: ${DEMO_URL}${NC}"
echo ""

# Get demo instance
INSTANCE_ID=$(get_demo_instance_id)
if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
    echo -e "${RED}❌ No running demo instance found${NC}"
    echo -e "${YELLOW}   Please start the demo first with: yarn demo:up${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Checking demo instance status...${NC}"
echo -e "   Instance ID: ${YELLOW}$INSTANCE_ID${NC}"

# Wait for API to be ready
echo -e "${YELLOW}⏳ Waiting for API to be ready...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s -f -o /dev/null "${HEALTH_URL}" 2>/dev/null; then
        echo -e "${GREEN}✅ API is ready!${NC}"
        break
    fi
    attempt=$((attempt + 1))
    if [ $((attempt % 5)) -eq 0 ]; then
        echo "  Attempt $attempt/$max_attempts - waiting for API..."
    fi
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}❌ API failed to become ready after $max_attempts attempts${NC}"
    exit 1
fi

# Reset demo data via API
echo ""
echo -e "${BLUE}🌱 Resetting demo database with comprehensive demo data...${NC}"
RESPONSE=$(curl -s -X POST "${API_URL}/demo/reset" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Demo database reseeded successfully!${NC}"
    echo ""
    echo -e "${GREEN}📊 Demo Environment:${NC}"
    echo -e "   🌐 Frontend: ${YELLOW}${DEMO_URL}${NC}"
    echo -e "   📡 API: ${YELLOW}${API_URL}${NC}"
    echo -e "   📚 Swagger: ${YELLOW}${API_URL}/docs${NC}"
    echo ""
    echo -e "${BLUE}💡 Demo credentials:${NC}"
    echo -e "   Email: ${YELLOW}fake@example.org${NC}"
    echo -e "   Password: ${YELLOW}Password1${NC}"
    echo ""
    echo -e "${GREEN}✅ Demo database has been reseeded!${NC}"
else
    echo -e "${RED}❌ Failed to reseed demo database${NC}"
    echo -e "   HTTP Code: $HTTP_CODE"
    echo -e "   Response: $BODY"
    exit 1
fi
