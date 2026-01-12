#!/bin/bash
# Script to start demo environment on AWS (demo.biancawellness.com)

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

# Get demo instance ID (demo has its own infrastructure)
get_demo_instance_id() {
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=bianca-demo" "Name=instance-state-name,Values=running,stopped" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text \
        --profile $AWS_PROFILE \
        --region $REGION
}

# Get demo instance status
get_demo_status() {
    local instance_id=$1
    aws ec2 describe-instances \
        --instance-ids $instance_id \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text \
        --profile $AWS_PROFILE \
        --region $REGION
}

# Wait for API to be ready
wait_for_api() {
    echo -e "${YELLOW}⏳ Waiting for API to be ready...${NC}"
    max_attempts=60
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f -o /dev/null "${API_URL}/health" 2>/dev/null; then
            echo -e "${GREEN}✅ API is ready!${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        if [ $((attempt % 10)) -eq 0 ]; then
            echo "  Attempt $attempt/$max_attempts - waiting for API..."
        fi
        sleep 5
    done
    
    echo -e "${RED}❌ API failed to become ready after $max_attempts attempts${NC}"
    return 1
}

echo -e "${BLUE}🚀 Starting demo environment on AWS...${NC}"
echo -e "${YELLOW}📍 Demo URL: ${DEMO_URL}${NC}"
echo ""

# Get demo instance
INSTANCE_ID=$(get_demo_instance_id)
if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
    echo -e "${RED}❌ No demo instance found${NC}"
    echo -e "${YELLOW}   Demo has its own infrastructure. Please check Terraform deployment.${NC}"
    echo -e "${YELLOW}   Run: cd devops/terraform && terraform apply${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Checking demo instance status...${NC}"
STATUS=$(get_demo_status $INSTANCE_ID)
echo -e "   Instance ID: ${YELLOW}$INSTANCE_ID${NC}"
echo -e "   Status: ${YELLOW}$STATUS${NC}"

# Start instance if stopped
if [ "$STATUS" = "stopped" ]; then
    echo -e "${YELLOW}🔄 Starting demo instance...${NC}"
    aws ec2 start-instances \
        --instance-ids $INSTANCE_ID \
        --profile $AWS_PROFILE \
        --region $REGION
    
    echo -e "${GREEN}✅ Instance start initiated${NC}"
    echo -e "${YELLOW}⏳ Waiting for instance to be running...${NC}"
    
    aws ec2 wait instance-running \
        --instance-ids $INSTANCE_ID \
        --profile $AWS_PROFILE \
        --region $REGION
    
    echo -e "${GREEN}✅ Instance is running${NC}"
    echo -e "${YELLOW}⏳ Waiting for services to initialize (this may take 2-3 minutes)...${NC}"
    sleep 30
elif [ "$STATUS" = "running" ]; then
    echo -e "${GREEN}✅ Instance is already running${NC}"
else
    echo -e "${YELLOW}⚠️  Instance is in state: $STATUS${NC}"
    echo -e "${YELLOW}⏳ Waiting for instance to be running...${NC}"
    aws ec2 wait instance-running \
        --instance-ids $INSTANCE_ID \
        --profile $AWS_PROFILE \
        --region $REGION || true
fi

# Wait for API to be ready
if ! wait_for_api; then
    echo -e "${RED}❌ Failed to start demo environment${NC}"
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
    echo -e "${GREEN}✅ Demo database reset successfully!${NC}"
    echo ""
    echo -e "${GREEN}📊 Demo Environment Ready:${NC}"
    echo -e "   🌐 Frontend: ${YELLOW}${DEMO_URL}${NC}"
    echo -e "   📡 API: ${YELLOW}${API_URL}${NC}"
    echo -e "   📚 Swagger: ${YELLOW}${API_URL}/docs${NC}"
    echo ""
    echo -e "${BLUE}💡 Demo credentials:${NC}"
    echo -e "   Email: ${YELLOW}fake@example.org${NC}"
    echo -e "   Password: ${YELLOW}Password1${NC}"
    echo ""
    echo -e "${GREEN}✅ Demo environment is up and ready!${NC}"
else
    echo -e "${RED}❌ Failed to reset demo database${NC}"
    echo -e "   HTTP Code: $HTTP_CODE"
    echo -e "   Response: $BODY"
    exit 1
fi
