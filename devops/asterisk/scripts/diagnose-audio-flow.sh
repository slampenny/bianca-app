#!/bin/bash

# Audio Flow Diagnostic Script for Asterisk
# Run this script on your Asterisk EC2 instance to diagnose audio flow issues

set -e

echo "🔍 Asterisk Audio Flow Diagnostic Starting..."
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Function to run Asterisk command and capture output
run_asterisk_cmd() {
    local cmd="$1"
    local description="$2"
    echo -e "\n${BLUE}Running: $description${NC}"
    echo "Command: $cmd"
    echo "----------------------------------------"
    
    if sudo docker exec asterisk asterisk -rx "$cmd" 2>/dev/null; then
        print_status "OK" "Command executed successfully"
    else
        print_status "ERROR" "Command failed or no output"
    fi
}

# Function to check if Docker container is running
check_docker_container() {
    echo -e "\n${BLUE}1. Checking Docker Container Status${NC}"
    echo "----------------------------------------"
    
    if sudo docker ps | grep -q asterisk; then
        print_status "OK" "Asterisk Docker container is running"
        sudo docker ps | grep asterisk
    else
        print_status "ERROR" "Asterisk Docker container is not running"
        echo "Available containers:"
        sudo docker ps -a
        exit 1
    fi
}

# Function to check Asterisk core status
check_asterisk_core() {
    echo -e "\n${BLUE}2. Checking Asterisk Core Status${NC}"
    echo "----------------------------------------"
    
    run_asterisk_cmd "core show version" "Asterisk Version"
    run_asterisk_cmd "core show uptime" "Asterisk Uptime"
    run_asterisk_cmd "core show channels" "Active Channels"
}

# Function to check SIP/PJSIP status
check_sip_status() {
    echo -e "\n${BLUE}3. Checking SIP/PJSIP Status${NC}"
    echo "----------------------------------------"
    
    run_asterisk_cmd "pjsip show endpoints" "PJSIP Endpoints"
    run_asterisk_cmd "pjsip show transports" "PJSIP Transports"
    run_asterisk_cmd "pjsip show auths" "PJSIP Authentication"
    run_asterisk_cmd "pjsip show aors" "PJSIP AORs"
}

# Function to check RTP configuration
check_rtp_config() {
    echo -e "\n${BLUE}4. Checking RTP Configuration${NC}"
    echo "----------------------------------------"
    
    run_asterisk_cmd "rtp show settings" "RTP Settings"
    run_asterisk_cmd "rtp show debug" "RTP Debug Status"
    
    # Check RTP port range
    echo -e "\n${BLUE}Checking RTP Port Range Configuration${NC}"
    if sudo docker exec asterisk grep -r "rtpstart\|rtpend" /etc/asterisk/ 2>/dev/null; then
        print_status "OK" "RTP port configuration found"
    else
        print_status "WARN" "RTP port configuration not found in config files"
    fi
}

# Function to check bridge status
check_bridge_status() {
    echo -e "\n${BLUE}5. Checking Bridge Status${NC}"
    echo "----------------------------------------"
    
    run_asterisk_cmd "bridge show all" "All Bridges"
    run_asterisk_cmd "bridge show all verbose" "Bridge Details"
}

# Function to check channel status
check_channel_status() {
    echo -e "\n${BLUE}6. Checking Channel Status${NC}"
    echo "----------------------------------------"
    
    run_asterisk_cmd "core show channels verbose" "Channel Details"
    
    # Get specific channel IDs if any exist
    local channels=$(sudo docker exec asterisk asterisk -rx "core show channels" 2>/dev/null | grep -E "^[0-9]+" | awk '{print $1}' | head -5)
    
    if [ -n "$channels" ]; then
        echo -e "\n${BLUE}Checking Specific Channels:${NC}"
        for channel in $channels; do
            run_asterisk_cmd "channel show $channel" "Channel $channel Details"
        done
    else
        print_status "INFO" "No active channels found"
    fi
}

# Function to check ARI status
check_ari_status() {
    echo -e "\n${BLUE}7. Checking ARI Status${NC}"
    echo "----------------------------------------"
    
    # Check if ARI is enabled
    if sudo docker exec asterisk grep -q "ari.conf" /etc/asterisk/http.conf 2>/dev/null; then
        print_status "OK" "ARI configuration found in http.conf"
    else
        print_status "WARN" "ARI configuration not found in http.conf"
    fi
    
    # Check ARI module status
    run_asterisk_cmd "module show like ari" "ARI Modules"
    
    # Check HTTP server status
    run_asterisk_cmd "http show status" "HTTP Server Status"
}

# Function to check network connectivity
check_network() {
    echo -e "\n${BLUE}8. Checking Network Configuration${NC}"
    echo "----------------------------------------"
    
    # Get container IP
    local container_ip=$(sudo docker inspect asterisk | grep '"IPAddress"' | head -1 | awk -F'"' '{print $4}')
    if [ -n "$container_ip" ]; then
        print_status "OK" "Container IP: $container_ip"
    else
        print_status "WARN" "Could not determine container IP"
    fi
    
    # Check external IP
    local external_ip=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "Not available")
    print_status "INFO" "External IP: $external_ip"
    
    # Check network interfaces
    echo -e "\n${BLUE}Network Interfaces:${NC}"
    sudo docker exec asterisk ip addr show | grep -E "inet.*eth"
}

# Function to check recent logs
check_recent_logs() {
    echo -e "\n${BLUE}9. Checking Recent Logs${NC}"
    echo "----------------------------------------"
    
    echo -e "\n${BLUE}Last 20 Asterisk log entries:${NC}"
    sudo docker logs asterisk --tail 20 2>/dev/null | grep -E "(RTP|SIP|PJSIP|bridge|channel|audio)" || echo "No relevant log entries found"
    
    echo -e "\n${BLUE}Recent errors:${NC}"
    sudo docker logs asterisk --tail 50 2>/dev/null | grep -i "error\|failed\|warning" | tail -10 || echo "No recent errors found"
}

# Function to provide diagnostic commands
show_diagnostic_commands() {
    echo -e "\n${BLUE}10. Diagnostic Commands to Run During a Call${NC}"
    echo "=============================================="
    echo ""
    echo "Run these commands while making a test call to see real-time data:"
    echo ""
    echo "1. Enable RTP debugging:"
    echo "   sudo docker exec asterisk asterisk -rx 'rtp set debug on'"
    echo ""
    echo "2. Watch RTP packets in real-time:"
    echo "   sudo tcpdump -i eth0 -n -s0 udp and portrange 10000-20000"
    echo ""
    echo "3. Monitor Asterisk logs in real-time:"
    echo "   sudo docker logs -f asterisk"
    echo ""
    echo "4. Check channel status during call:"
    echo "   sudo docker exec asterisk asterisk -rx 'core show channels verbose'"
    echo ""
    echo "5. Check bridge status during call:"
    echo "   sudo docker exec asterisk asterisk -rx 'bridge show all'"
    echo ""
    echo "6. Monitor SIP signaling:"
    echo "   sudo docker exec asterisk asterisk -rx 'pjsip set logger on'"
    echo ""
    echo "7. Check RTP statistics:"
    echo "   sudo docker exec asterisk asterisk -rx 'rtp show debug'"
    echo ""
}

# Main execution
main() {
    check_docker_container
    check_asterisk_core
    check_sip_status
    check_rtp_config
    check_bridge_status
    check_channel_status
    check_ari_status
    check_network
    check_recent_logs
    show_diagnostic_commands
    
    echo -e "\n${GREEN}🔍 Audio Flow Diagnostic Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Make a test call while running the diagnostic commands above"
    echo "2. Check if RTP packets are being received from your app"
    echo "3. Verify that bridges are created and channels are added"
    echo "4. Monitor the logs for any errors during the call"
    echo ""
    echo "Common issues to look for:"
    echo "- RTP packets not reaching Asterisk (network/firewall issue)"
    echo "- Channels not being added to bridges"
    echo "- ExternalMedia not configured correctly"
    echo "- Audio format mismatches (μ-law vs other formats)"
    echo "- Port allocation conflicts"
}

# Run the main function
main "$@" 