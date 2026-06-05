#!/bin/bash

# staging-control.sh
# Easy control of staging environment for cost optimization

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# AWS (override with env: AWS_PROFILE, AWS_REGION)
AWS_PROFILE="${AWS_PROFILE:-jordan}"
REGION="${AWS_REGION:-us-east-2}"

# Get staging instance ID (newest launch wins if multiple share Name=bianca-staging)
get_staging_instance_id() {
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=bianca-staging" "Name=instance-state-name,Values=running,stopped,pending,stopping" \
        --query 'sort_by(Reservations[].Instances[], &LaunchTime)[-1].InstanceId' \
        --output text \
        --profile $AWS_PROFILE \
        --region $REGION
}

# Get staging instance status
get_staging_status() {
    local instance_id=$1
    aws ec2 describe-instances \
        --instance-ids $instance_id \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text \
        --profile $AWS_PROFILE \
        --region $REGION
}

# Get staging instance IP
get_staging_ip() {
    local instance_id=$1
    aws ec2 describe-instances \
        --instance-ids $instance_id \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text \
        --profile $AWS_PROFILE \
        --region $REGION
}

# Show current status
show_status() {
    echo -e "${BLUE}🔍 Checking staging environment status...${NC}"
    
    local instance_id=$(get_staging_instance_id)
    if [ "$instance_id" = "None" ] || [ -z "$instance_id" ]; then
        echo -e "${RED}❌ No staging instance found${NC}"
        return 1
    fi
    
    local status=$(get_staging_status $instance_id)
    local ip=$(get_staging_ip $instance_id)
    
    echo -e "Instance ID: ${YELLOW}$instance_id${NC}"
    echo -e "Status: ${GREEN}$status${NC}"
    echo -e "IP: ${YELLOW}$ip${NC}"
    
    # Check always-on setting
    local always_on=$(aws ssm get-parameter \
        --name "/bianca/staging/always-on" \
        --query 'Parameter.Value' \
        --output text \
        --profile $AWS_PROFILE \
        --region $REGION 2>/dev/null || echo "false")
    
    echo -e "Always-on mode: ${YELLOW}$always_on${NC}"
    echo -e "Auto-stop Lambda: ${YELLOW}bianca-staging-auto-stop${NC} (every 30m if idle — stops bianca-staging + bianca-demo; never starts)"
    echo -e "Start staging: ${YELLOW}manual only${NC} (yarn staging:up or staging-control.sh start)"
}

# Start staging instance
start_staging() {
    echo -e "${BLUE}🚀 Starting staging instance...${NC}"
    
    local instance_id=$(get_staging_instance_id)
    if [ "$instance_id" = "None" ] || [ -z "$instance_id" ]; then
        echo -e "${RED}❌ No staging instance found${NC}"
        return 1
    fi
    
    local status=$(get_staging_status $instance_id)
    
    if [ "$status" = "running" ]; then
        echo -e "${YELLOW}⚠️  Instance is already running${NC}"
        return 0
    fi

    if [ "$status" = "pending" ]; then
        echo -e "${YELLOW}⚠️  Instance is already starting (pending)${NC}"
        aws ec2 wait instance-running \
            --instance-ids $instance_id \
            --profile $AWS_PROFILE \
            --region $REGION
        local ip=$(get_staging_ip $instance_id)
        echo -e "${GREEN}✅ Instance is running at $ip${NC}"
        return 0
    fi

    if [ "$status" = "stopping" ] || [ "$status" = "shutting-down" ]; then
        echo -e "${RED}❌ Instance is $status — wait until it is fully stopped, then run staging:up again${NC}"
        return 1
    fi
    
    aws ec2 start-instances \
        --instance-ids $instance_id \
        --profile $AWS_PROFILE \
        --region $REGION
    
    echo -e "${GREEN}✅ Instance start initiated${NC}"
    echo -e "${YELLOW}⏳ Waiting for instance to be ready...${NC}"
    
    # Wait for instance to be running
    aws ec2 wait instance-running \
        --instance-ids $instance_id \
        --profile $AWS_PROFILE \
        --region $REGION
    
    local ip=$(get_staging_ip $instance_id)
    echo -e "${GREEN}✅ Instance is running at $ip${NC}"
}

# Stop staging instance
stop_staging() {
    echo -e "${BLUE}🛑 Stopping staging instance...${NC}"
    
    local instance_id=$(get_staging_instance_id)
    if [ "$instance_id" = "None" ] || [ -z "$instance_id" ]; then
        echo -e "${RED}❌ No staging instance found${NC}"
        return 1
    fi
    
    local status=$(get_staging_status $instance_id)
    
    if [ "$status" = "stopped" ]; then
        echo -e "${YELLOW}⚠️  Instance is already stopped${NC}"
        return 0
    fi
    
    aws ec2 stop-instances \
        --instance-ids $instance_id \
        --profile $AWS_PROFILE \
        --region $REGION
    
    echo -e "${GREEN}✅ Instance stop initiated${NC}"
}

# Enable always-on mode
enable_always_on() {
    echo -e "${BLUE}🔒 Enabling always-on mode...${NC}"
    
    aws ssm put-parameter \
        --name "/bianca/staging/always-on" \
        --value "true" \
        --type "String" \
        --overwrite \
        --profile $AWS_PROFILE \
        --region $REGION
    
    echo -e "${GREEN}✅ Always-on mode enabled${NC}"
    echo -e "${YELLOW}ℹ️  Staging will now run 24/7 regardless of schedule${NC}"
}

# Disable always-on mode
disable_always_on() {
    echo -e "${BLUE}🔓 Disabling always-on mode...${NC}"
    
    aws ssm put-parameter \
        --name "/bianca/staging/always-on" \
        --value "false" \
        --type "String" \
        --overwrite \
        --profile $AWS_PROFILE \
        --region $REGION
    
    echo -e "${GREEN}✅ Always-on mode disabled${NC}"
    echo -e "${YELLOW}ℹ️  Staging will now follow business hours schedule${NC}"
}

# Deploy to staging
deploy_staging() {
    echo -e "${BLUE}🚀 Deploying to staging...${NC}"
    
    # Start instance if not running
    local instance_id=$(get_staging_instance_id)
    local status=$(get_staging_status $instance_id)
    
    if [ "$status" = "stopped" ]; then
        echo -e "${YELLOW}⚠️  Instance is stopped, starting it first...${NC}"
        start_staging
        sleep 30  # Wait for instance to be fully ready
    fi
    
    # Run deployment
    ./scripts/deploy-staging.sh
}

# Show usage
show_usage() {
    echo -e "${BLUE}Bianca Staging Control${NC}"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  status     - Show current staging status"
    echo "  start      - Start staging instance"
    echo "  stop       - Stop staging instance"
    echo "  deploy     - Deploy to staging (starts instance if needed)"
    echo "  always-on  - Enable always-on mode (24/7)"
    echo "  schedule   - Disable always-on mode (business hours only)"
    echo "  help       - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 start"
    echo "  $0 deploy"
    echo "  $0 always-on"
}

# Main script logic
case "${1:-help}" in
    status)
        show_status
        ;;
    start)
        start_staging
        ;;
    stop)
        stop_staging
        ;;
    deploy)
        deploy_staging
        ;;
    always-on)
        enable_always_on
        ;;
    schedule)
        disable_always_on
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
