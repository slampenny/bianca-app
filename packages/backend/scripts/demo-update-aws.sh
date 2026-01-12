#!/bin/bash
# Script to update demo environment on AWS (pull latest images and restart containers)

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
SSH_KEY="${HOME}/.ssh/bianca-key-pair.pem"

# Get demo instance ID and IP
get_demo_instance_info() {
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=bianca-demo" "Name=instance-state-name,Values=running" \
        --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress]' \
        --output text \
        --profile $AWS_PROFILE \
        --region $REGION
}

echo -e "${BLUE}🔄 Updating demo environment on AWS...${NC}"
echo -e "${YELLOW}📍 Demo URL: ${DEMO_URL}${NC}"
echo ""

# Get demo instance info
INSTANCE_INFO=$(get_demo_instance_info)
if [ -z "$INSTANCE_INFO" ] || [ "$INSTANCE_INFO" = "None" ]; then
    echo -e "${RED}❌ No running demo instance found${NC}"
    echo -e "${YELLOW}   Please start the demo first with: yarn demo:up${NC}"
    exit 1
fi

INSTANCE_ID=$(echo "$INSTANCE_INFO" | awk '{print $1}')
INSTANCE_IP=$(echo "$INSTANCE_INFO" | awk '{print $2}')

echo -e "${BLUE}📦 Demo instance:${NC}"
echo -e "   Instance ID: ${YELLOW}$INSTANCE_ID${NC}"
echo -e "   IP Address: ${YELLOW}$INSTANCE_IP${NC}"
echo ""

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH key not found: $SSH_KEY${NC}"
    exit 1
fi

# Update containers via SSH
echo -e "${YELLOW}🔄 Pulling latest images and updating containers...${NC}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$INSTANCE_IP << 'EOF'
    set -e
    cd /opt/bianca-demo
    
    echo "📥 Pulling latest images..."
    sudo docker-compose pull
    
    echo "🔄 Restarting containers with new images..."
    sudo docker-compose up -d
    
    echo "✅ Containers updated!"
    echo ""
    echo "📊 Container status:"
    sudo docker-compose ps
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Demo environment updated successfully!${NC}"
    echo ""
    echo -e "${GREEN}📊 Demo Environment:${NC}"
    echo -e "   🌐 Frontend: ${YELLOW}${DEMO_URL}${NC}"
    echo -e "   📡 API: ${YELLOW}${DEMO_URL}/v1${NC}"
    echo ""
    echo -e "${BLUE}💡 Demo credentials:${NC}"
    echo -e "   Email: ${YELLOW}fake@example.org${NC}"
    echo -e "   Password: ${YELLOW}Password1${NC}"
else
    echo -e "${RED}❌ Failed to update demo environment${NC}"
    exit 1
fi
