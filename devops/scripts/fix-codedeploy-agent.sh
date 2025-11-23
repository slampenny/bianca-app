#!/bin/bash
# Fix CodeDeploy agent on existing EC2 instance
# Run this via SSM or SSH to diagnose and fix CodeDeploy agent issues

set -e

echo "=== CodeDeploy Agent Diagnostic and Fix Script ==="
echo ""

# Check current status
echo "1. Checking current agent status..."
sudo systemctl status codedeploy-agent --no-pager | head -20 || echo "Agent not running or not installed"
echo ""

# Check if agent process is running
echo "2. Checking for agent process..."
if pgrep -f codedeploy-agent > /dev/null; then
    echo "✅ Agent process is running"
    ps aux | grep codedeploy-agent | grep -v grep
else
    echo "❌ Agent process not found"
fi
echo ""

# Check logs
echo "3. Recent agent logs (last 50 lines)..."
if [ -f /var/log/aws/codedeploy-agent/codedeploy-agent.log ]; then
    sudo tail -50 /var/log/aws/codedeploy-agent/codedeploy-agent.log
else
    echo "Log file not found at /var/log/aws/codedeploy-agent/codedeploy-agent.log"
fi
echo ""

# Check IAM role
echo "4. Checking IAM instance profile..."
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
echo "Instance ID: $INSTANCE_ID"
aws sts get-caller-identity || echo "Cannot get IAM identity"
echo ""

# Reinstall agent
echo "5. Reinstalling CodeDeploy agent..."
cd /tmp
sudo systemctl stop codedeploy-agent 2>/dev/null || true
sudo yum remove -y codedeploy-agent 2>/dev/null || true

REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
echo "Region: $REGION"

if wget https://aws-codedeploy-${REGION}.s3.${REGION}.amazonaws.com/latest/install -O install; then
    chmod +x ./install
    if sudo ./install auto; then
        echo "✅ Agent installed successfully"
    else
        echo "❌ Agent installation failed"
        exit 1
    fi
else
    echo "❌ Failed to download agent installer"
    exit 1
fi

# Start agent
echo "6. Starting CodeDeploy agent..."
sudo systemctl enable codedeploy-agent
if sudo systemctl start codedeploy-agent; then
    echo "✅ Agent started"
else
    echo "❌ Failed to start agent"
    sudo systemctl status codedeploy-agent --no-pager
    exit 1
fi

# Verify
echo "7. Verifying agent status..."
sleep 10
if sudo systemctl is-active --quiet codedeploy-agent; then
    echo "✅ CodeDeploy agent is running"
    sudo systemctl status codedeploy-agent --no-pager | head -15
else
    echo "❌ Agent is not running"
    sudo systemctl status codedeploy-agent --no-pager
    sudo tail -30 /var/log/aws/codedeploy-agent/codedeploy-agent.log 2>&1 || true
    exit 1
fi

echo ""
echo "=== Fix complete ==="
echo "Agent should now be able to receive lifecycle events from CodeDeploy"




