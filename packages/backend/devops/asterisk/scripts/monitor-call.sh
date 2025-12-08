#!/bin/bash

# Real-time Call Monitoring Script
# Run this script during a test call to monitor audio flow

set -e

echo "📞 Real-time Call Monitoring Starting..."
echo "========================================"
echo ""
echo "This script will monitor Asterisk during a call to diagnose audio flow issues."
echo "Make a test call and watch the output below."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print timestamp
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Function to monitor channels
monitor_channels() {
    echo -e "\n${BLUE}[$(timestamp)] Monitoring Channels...${NC}"
    echo "----------------------------------------"
    sudo docker exec asterisk asterisk -rx "core show channels" 2>/dev/null || echo "No channels found"
}

# Function to monitor bridges
monitor_bridges() {
    echo -e "\n${BLUE}[$(timestamp)] Monitoring Bridges...${NC}"
    echo "----------------------------------------"
    sudo docker exec asterisk asterisk -rx "bridge show all" 2>/dev/null || echo "No bridges found"
}

# Function to monitor RTP
monitor_rtp() {
    echo -e "\n${BLUE}[$(timestamp)] Monitoring RTP...${NC}"
    echo "----------------------------------------"
    sudo docker exec asterisk asterisk -rx "rtp show debug" 2>/dev/null || echo "RTP debug not available"
}

# Function to check specific channel details
check_channel_details() {
    local channel_id=$1
    if [ -n "$channel_id" ]; then
        echo -e "\n${BLUE}[$(timestamp)] Channel $channel_id Details...${NC}"
        echo "----------------------------------------"
        sudo docker exec asterisk asterisk -rx "channel show $channel_id" 2>/dev/null || echo "Channel not found"
    fi
}

# Function to monitor logs in real-time
monitor_logs() {
    echo -e "\n${BLUE}[$(timestamp)] Monitoring Asterisk Logs (filtered)...${NC}"
    echo "----------------------------------------"
    sudo docker logs asterisk --tail 10 2>/dev/null | grep -E "(RTP|SIP|PJSIP|bridge|channel|audio|ExternalMedia|UnicastRTP)" || echo "No relevant log entries"
}

# Function to check network connectivity
check_network() {
    echo -e "\n${BLUE}[$(timestamp)] Checking Network...${NC}"
    echo "----------------------------------------"
    
    # Check if we can reach the app container
    local app_ip=$(sudo docker inspect asterisk | grep '"IPAddress"' | head -1 | awk -F'"' '{print $4}')
    if [ -n "$app_ip" ]; then
        echo "Container IP: $app_ip"
        
        # Try to ping the app container (if in same network)
        if ping -c 1 $app_ip >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Can reach app container${NC}"
        else
            echo -e "${YELLOW}⚠️  Cannot ping app container${NC}"
        fi
    fi
}

# Function to show RTP packet capture
show_rtp_packets() {
    echo -e "\n${BLUE}[$(timestamp)] RTP Packet Capture (last 10 packets)...${NC}"
    echo "----------------------------------------"
    
    # Use tcpdump to capture RTP packets
    timeout 5 sudo tcpdump -i eth0 -n -s0 -c 10 udp and portrange 10000-20000 2>/dev/null || echo "No RTP packets captured"
}

# Function to check SIP signaling
check_sip_signaling() {
    echo -e "\n${BLUE}[$(timestamp)] Checking SIP Signaling...${NC}"
    echo "----------------------------------------"
    sudo docker exec asterisk asterisk -rx "pjsip show endpoints" 2>/dev/null || echo "No PJSIP endpoints found"
}

# Function to show call summary
show_call_summary() {
    echo -e "\n${BLUE}[$(timestamp)] Call Summary${NC}"
    echo "========================================"
    
    local channel_count=$(sudo docker exec asterisk asterisk -rx "core show channels" 2>/dev/null | grep -c "^[0-9]" || echo "0")
    local bridge_count=$(sudo docker exec asterisk asterisk -rx "bridge show all" 2>/dev/null | grep -c "Bridge" || echo "0")
    
    echo "Active Channels: $channel_count"
    echo "Active Bridges: $bridge_count"
    
    if [ "$channel_count" -gt 0 ]; then
        echo -e "${GREEN}✅ Call appears to be active${NC}"
    else
        echo -e "${YELLOW}⚠️  No active channels found${NC}"
    fi
    
    if [ "$bridge_count" -gt 0 ]; then
        echo -e "${GREEN}✅ Bridges are created${NC}"
    else
        echo -e "${YELLOW}⚠️  No bridges found${NC}"
    fi
}

# Function to provide troubleshooting tips
show_troubleshooting_tips() {
    echo -e "\n${BLUE}Troubleshooting Tips:${NC}"
    echo "========================"
    echo ""
    echo "If you see no channels:"
    echo "  - Check if the call is actually reaching Asterisk"
    echo "  - Verify SIP configuration and Twilio connectivity"
    echo "  - Check Asterisk logs for connection errors"
    echo ""
    echo "If you see channels but no bridges:"
    echo "  - The ARI application may not be creating bridges"
    echo "  - Check if the Stasis application is running"
    echo "  - Verify ARI configuration and connectivity"
    echo ""
    echo "If you see bridges but no audio:"
    echo "  - Check if ExternalMedia channels are created"
    echo "  - Verify RTP port allocation and network routing"
    echo "  - Check if the app is sending RTP packets"
    echo ""
    echo "If you see RTP packets but no audio:"
    echo "  - Check audio format (should be μ-law)"
    echo "  - Verify sample rate (should be 8kHz)"
    echo "  - Check if channels are properly added to bridges"
    echo ""
}

# Main monitoring loop
main() {
    echo "Starting monitoring loop. Press Ctrl+C to stop."
    echo ""
    
    # Enable RTP debugging
    echo -e "${BLUE}Enabling RTP debugging...${NC}"
    sudo docker exec asterisk asterisk -rx "rtp set debug on" 2>/dev/null || echo "Could not enable RTP debug"
    
    # Enable PJSIP logging
    echo -e "${BLUE}Enabling PJSIP logging...${NC}"
    sudo docker exec asterisk asterisk -rx "pjsip set logger on" 2>/dev/null || echo "Could not enable PJSIP logging"
    
    echo ""
    echo "Monitoring started. Make a test call now..."
    echo ""
    
    # Monitoring loop
    while true; do
        show_call_summary
        monitor_channels
        monitor_bridges
        monitor_rtp
        check_sip_signaling
        check_network
        show_rtp_packets
        monitor_logs
        
        echo ""
        echo -e "${YELLOW}Waiting 10 seconds before next check... (Press Ctrl+C to stop)${NC}"
        echo "========================================"
        sleep 10
    done
}

# Trap Ctrl+C to clean up
trap 'echo -e "\n${GREEN}Monitoring stopped.${NC}"; exit 0' INT

# Show initial troubleshooting tips
show_troubleshooting_tips

# Run the main monitoring loop
main "$@" 