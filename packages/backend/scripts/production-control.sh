#!/bin/bash

# production-control.sh
# Start or stop the live production EC2 instance on demand.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AWS_PROFILE="${AWS_PROFILE:-jordan}"
REGION="${AWS_REGION:-ca-central-1}"

aws_cmd() {
    aws "$@" --profile "$AWS_PROFILE" --region "$REGION"
}

# Prefer the instance that holds the production SIP EIP; fallback to newest Name=bianca-production.
get_production_instance_id() {
    local eip_instance
    eip_instance=$(aws_cmd ec2 describe-addresses \
        --filters "Name=tag:Name,Values=bianca-production-eip" \
        --query 'Addresses[0].InstanceId' \
        --output text 2>/dev/null || true)

    if [ -n "$eip_instance" ] && [ "$eip_instance" != "None" ]; then
        echo "$eip_instance"
        return
    fi

    aws_cmd ec2 describe-instances \
        --filters "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running,stopped,pending,stopping" \
        --query 'sort_by(Reservations[].Instances[], &LaunchTime)[-1].InstanceId' \
        --output text
}

get_production_status() {
    local instance_id=$1
    aws_cmd ec2 describe-instances \
        --instance-ids "$instance_id" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text
}

get_production_ip() {
    local instance_id=$1
    aws_cmd ec2 describe-instances \
        --instance-ids "$instance_id" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text
}

show_status() {
    echo -e "${BLUE}Checking production environment status...${NC}"

    local instance_id
    instance_id=$(get_production_instance_id)
    if [ "$instance_id" = "None" ] || [ -z "$instance_id" ]; then
        echo -e "${RED}No production instance found${NC}"
        return 1
    fi

    local status ip
    status=$(get_production_status "$instance_id")
    ip=$(get_production_ip "$instance_id")

    echo -e "Instance ID: ${YELLOW}$instance_id${NC}"
    echo -e "Status: ${GREEN}$status${NC}"
    echo -e "Public IP: ${YELLOW}$ip${NC}"
    echo -e "Scheduled window: ${YELLOW}EventBridge 07:00-13:00 Pacific${NC} (see production-schedule.tf)"
    echo -e "Manual control: ${YELLOW}yarn production:up${NC} / ${YELLOW}yarn production:down${NC}"
}

start_production() {
    echo -e "${BLUE}Starting production instance...${NC}"

    local instance_id
    instance_id=$(get_production_instance_id)
    if [ "$instance_id" = "None" ] || [ -z "$instance_id" ]; then
        echo -e "${RED}No production instance found${NC}"
        return 1
    fi

    local status
    status=$(get_production_status "$instance_id")

    if [ "$status" = "running" ]; then
        echo -e "${YELLOW}Instance is already running${NC}"
        return 0
    fi

    if [ "$status" = "pending" ]; then
        echo -e "${YELLOW}Instance is already starting (pending)${NC}"
        aws_cmd ec2 wait instance-running --instance-ids "$instance_id"
        echo -e "${GREEN}Instance is running at $(get_production_ip "$instance_id")${NC}"
        return 0
    fi

    if [ "$status" = "stopping" ] || [ "$status" = "shutting-down" ]; then
        echo -e "${RED}Instance is $status — wait until it is fully stopped, then run production:up again${NC}"
        return 1
    fi

    aws_cmd ec2 start-instances --instance-ids "$instance_id"
    echo -e "${GREEN}Instance start initiated${NC}"
    echo -e "${YELLOW}Waiting for instance to be running...${NC}"

    aws_cmd ec2 wait instance-running --instance-ids "$instance_id"

    echo -e "${GREEN}Instance is running at $(get_production_ip "$instance_id")${NC}"
    echo -e "${YELLOW}Allow a few minutes for Docker containers and ALB health checks.${NC}"
}

stop_production() {
    echo -e "${BLUE}Stopping production instance...${NC}"

    local instance_id
    instance_id=$(get_production_instance_id)
    if [ "$instance_id" = "None" ] || [ -z "$instance_id" ]; then
        echo -e "${RED}No production instance found${NC}"
        return 1
    fi

    local status
    status=$(get_production_status "$instance_id")

    if [ "$status" = "stopped" ]; then
        echo -e "${YELLOW}Instance is already stopped${NC}"
        return 0
    fi

    aws_cmd ec2 stop-instances --instance-ids "$instance_id"
    echo -e "${GREEN}Instance stop initiated${NC}"
    echo -e "${YELLOW}API, app, and SIP will be unavailable until production:up or the daily schedule starts the instance.${NC}"
}

show_usage() {
    echo -e "${BLUE}Bianca Production Control${NC}"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start   - Start the live production instance"
    echo "  stop    - Stop the live production instance"
    echo "  status  - Show current production status"
    echo "  help    - Show this help message"
    echo ""
    echo "Examples:"
    echo "  yarn production:up"
    echo "  yarn production:down"
    echo "  $0 status"
}

case "${1:-help}" in
    status)
        show_status
        ;;
    start)
        start_production
        ;;
    stop)
        stop_production
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
