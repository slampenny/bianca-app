#!/bin/bash
# Script to diagnose WordPress timeout issues
# Auto-recovery only handles EC2 hardware failures, not application timeouts

set -e

echo "=========================================="
echo "WordPress Timeout Diagnosis"
echo "=========================================="
echo ""
echo "⚠️  Note: Auto-recovery only handles EC2 hardware failures."
echo "   Application timeouts (504/Request Timeout) require manual investigation."
echo ""

# Get instance ID
cd "$(dirname "$0")/../devops/terraform-wordpress" || exit 1
INSTANCE_ID=$(terraform output -raw wordpress_instance_id 2>/dev/null || echo "")

if [ -z "$INSTANCE_ID" ]; then
    echo "❌ Could not get WordPress instance ID from Terraform"
    echo "   Please run: cd devops/terraform-wordpress && terraform output wordpress_instance_id"
    exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo ""

# Check EC2 instance status (this is what auto-recovery monitors)
echo "1. Checking EC2 Instance Status (Auto-Recovery Monitor)..."
aws ec2 describe-instance-status --instance-ids "$INSTANCE_ID" \
    --query 'InstanceStatuses[0].[InstanceStatus.Status,SystemStatus.Status]' \
    --output table

echo ""
echo "   ✅ If SystemStatus is 'ok', auto-recovery won't trigger"
echo "   ⚠️  Application timeouts don't trigger auto-recovery"
echo ""

# Check ALB target health
echo "2. Checking ALB Target Health..."
TG_ARN=$(aws elbv2 describe-target-groups --names bianca-wordpress-tg \
    --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")

if [ -n "$TG_ARN" ]; then
    aws elbv2 describe-target-health --target-group-arn "$TG_ARN" \
        --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason,TargetHealth.Description]' \
        --output table
else
    echo "   ⚠️  Could not find target group"
fi

echo ""

# Check CPU and memory metrics
echo "3. Checking Recent CPU Usage (last 10 minutes)..."
CPU_AVG=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/EC2 \
    --metric-name CPUUtilization \
    --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
    --start-time "$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S)" \
    --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
    --period 300 \
    --statistics Average \
    --query 'Datapoints[-1].Average' \
    --output text 2>/dev/null || echo "N/A")

echo "   CPU Average: ${CPU_AVG}%"
if [ "$CPU_AVG" != "N/A" ] && (( $(echo "$CPU_AVG > 80" | bc -l) )); then
    echo "   ⚠️  High CPU usage detected!"
fi

echo ""

# Check CloudWatch alarms
echo "4. Checking CloudWatch Alarms..."
aws cloudwatch describe-alarms-for-metric \
    --namespace AWS/EC2 \
    --metric-name StatusCheckFailed_System \
    --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
    --query 'MetricAlarms[*].[AlarmName,StateValue]' \
    --output table 2>/dev/null || echo "   ⚠️  Could not check alarms"

echo ""

# Provide SSM commands to check application
echo "5. To Check Application Status (run these via SSM):"
echo ""
echo "   # Check Apache status"
echo "   aws ssm send-command \\"
echo "       --instance-ids $INSTANCE_ID \\"
echo "       --document-name 'AWS-RunShellScript' \\"
echo "       --parameters 'commands=[\"sudo systemctl status httpd\",\"sudo systemctl status php-fpm\",\"free -h\",\"df -h\"]'"
echo ""
echo "   # Check Apache error logs"
echo "   aws ssm send-command \\"
echo "       --instance-ids $INSTANCE_ID \\"
echo "       --document-name 'AWS-RunShellScript' \\"
echo "       --parameters 'commands=[\"sudo tail -50 /var/log/httpd/error_log\"]'"
echo ""
echo "   # Check if Apache is responding locally"
echo "   aws ssm send-command \\"
echo "       --instance-ids $INSTANCE_ID \\"
echo "       --document-name 'AWS-RunShellScript' \\"
echo "       --parameters 'commands=[\"curl -I http://localhost\",\"ps aux | grep httpd\"]'"
echo ""

echo "=========================================="
echo "Common Causes of Application Timeouts:"
echo "=========================================="
echo "1. Apache/PHP crashed or hung"
echo "2. Database connection issues (MySQL not responding)"
echo "3. Resource exhaustion (memory, disk space)"
echo "4. PHP-FPM process pool exhausted"
echo "5. WordPress plugin/theme causing infinite loops"
echo ""
echo "Auto-recovery will NOT fix these - they require:"
echo "- Restarting Apache: sudo systemctl restart httpd"
echo "- Restarting PHP-FPM: sudo systemctl restart php-fpm"
echo "- Checking logs: /var/log/httpd/error_log"
echo "- Checking database: sudo systemctl status mariadb"
echo ""

