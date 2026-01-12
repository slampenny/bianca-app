#!/bin/bash
# Script to stop demo environment on AWS (demo.biancawellness.com)

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

echo -e "${BLUE}🛑 Stopping demo environment on AWS...${NC}"
echo -e "${GREEN}✅ Demo has its own infrastructure - stopping will not affect staging${NC}"
echo ""

# Get demo instance
INSTANCE_ID=$(get_demo_instance_id)
if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
    echo -e "${RED}❌ No demo instance found${NC}"
    exit 1
fi

STATUS=$(get_demo_status $INSTANCE_ID)
echo -e "   Instance ID: ${YELLOW}$INSTANCE_ID${NC}"
echo -e "   Status: ${YELLOW}$STATUS${NC}"

if [ "$STATUS" = "stopped" ]; then
    echo -e "${YELLOW}⚠️  Instance is already stopped${NC}"
    echo -e "${GREEN}✅ Demo environment is down${NC}"
    exit 0
fi

echo -e "${YELLOW}🔄 Stopping demo instance...${NC}"
aws ec2 stop-instances \
    --instance-ids $INSTANCE_ID \
    --profile $AWS_PROFILE \
    --region $REGION

echo -e "${GREEN}✅ Instance stop initiated${NC}"
echo -e "${YELLOW}⏳ Waiting for instance to stop...${NC}"

aws ec2 wait instance-stopped \
    --instance-ids $INSTANCE_ID \
    --profile $AWS_PROFILE \
    --region $REGION

echo ""
echo -e "${GREEN}✅ Demo environment stopped${NC}"
echo -e "${YELLOW}💡 To start again, run: yarn demo:up${NC}"
