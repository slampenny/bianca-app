#!/usr/bin/env bash
# Quick diagnostic for production 503.
# Run with: AWS_PROFILE=jordan ./check-production-503.sh
# Or from project root: ./packages/backend/devops/terraform/check-production-503.sh

set -e
REGION="${AWS_REGION:-ca-central-1}"

echo "=== Production 503 diagnostic ==="
echo ""

# 1. Production instance
echo "1. Production instance(s):"
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=bianca-production" "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,LaunchTime,State.Name]' \
  --output table --region "$REGION" 2>/dev/null || echo "   (Need AWS access - run with AWS_PROFILE=jordan)"

# 2. Target group health (need profile with ELB access)
echo ""
echo "2. ALB target health (API - port 3000):"
TG_ARN=$(aws elbv2 describe-target-groups --names bianca-production-api-tg --query 'TargetGroups[0].TargetGroupArn' --output text --region "$REGION" 2>/dev/null || true)
if [ -n "$TG_ARN" ] && [ "$TG_ARN" != "None" ]; then
  aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --region "$REGION" --output table 2>/dev/null || true
else
  echo "   (Could not get target group - check AWS permissions)"
fi

echo ""
echo "3. Quick fix ideas:"
echo "   - If the instance was just recreated: wait 10–15 min for userdata + first deploy."
echo "   - Re-run the production pipeline (push to main or 'Release change' in CodePipeline) so the new instance gets a deployment."
echo "   - SSH to the instance and run:"
echo "       sudo docker ps -a"
echo "       sudo docker logs production_app --tail 100"
echo "       curl -s http://localhost:3000/health"
echo "     SSH: ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<production-ip>"
echo ""
