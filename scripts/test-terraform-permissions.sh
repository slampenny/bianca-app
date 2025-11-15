#!/bin/bash
# Quick test to validate Terraform can read all resources
# Uses your local AWS profile to test permissions

set -e

echo "🧪 Testing Terraform Permissions (Quick Test)"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

test_command() {
    local name=$1
    local command=$2
    
    echo -n "Testing: $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌${NC}"
        eval "$command" 2>&1 | head -2 | sed 's/^/   /'
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "📋 Testing critical permissions that Terraform needs..."
echo ""

# Test Terraform state access
test_command "S3: Terraform state bucket" \
    "aws s3 ls s3://bianca-terraform-state/ --profile jordan"

test_command "DynamoDB: State lock table" \
    "aws dynamodb describe-table --table-name terraform-state-lock --region us-east-2 --profile jordan --query 'Table.TableName' --output text"

echo ""
echo "🔍 Testing Terraform read operations..."
echo ""

# Test read permissions
test_command "EC2: Describe instances" \
    "aws ec2 describe-instances --filters 'Name=tag:Name,Values=bianca-staging' --profile jordan --query 'Reservations[0].Instances[0].InstanceId' --output text"

test_command "EC2: Describe VPCs" \
    "aws ec2 describe-vpcs --profile jordan --query 'Vpcs[0].VpcId' --output text"

test_command "EC2: Describe availability zones" \
    "aws ec2 describe-availability-zones --profile jordan --query 'AvailabilityZones[0].ZoneName' --output text"

test_command "ELBv2: Describe load balancers" \
    "aws elbv2 describe-load-balancers --profile jordan --query 'LoadBalancers[0].LoadBalancerName' --output text"

test_command "Route53: List hosted zones" \
    "aws route53 list-hosted-zones --profile jordan --query 'HostedZones[0].Name' --output text"

test_command "ACM: List certificates" \
    "aws acm list-certificates --profile jordan --query 'CertificateSummaryList[0].DomainName' --output text"

test_command "IAM: Get GitHub Actions role" \
    "aws iam get-role --role-name github-actions-deploy-role --profile jordan --query 'Role.RoleName' --output text"

test_command "ECR: Describe repositories" \
    "aws ecr describe-repositories --profile jordan --query 'repositories[0].repositoryName' --output text"

test_command "CloudWatch Logs: Describe log groups" \
    "aws logs describe-log-groups --profile jordan --query 'logGroups[0].logGroupName' --output text"

echo ""
echo "📡 Testing SSM (critical for deployment)..."
echo ""

STAGING_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=bianca-staging" \
    --profile jordan \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null)

if [ "$STAGING_INSTANCE" != "None" ] && [ -n "$STAGING_INSTANCE" ]; then
    echo "   Found staging instance: $STAGING_INSTANCE"
    
    test_command "SSM: Describe instance" \
        "aws ssm describe-instance-information --filters \"Key=InstanceIds,Values=$STAGING_INSTANCE\" --profile jordan --query 'InstanceInformationList[0].InstanceId' --output text"
    
    # Test if we can send a command (this will actually create a command, but it's harmless)
    echo -n "Testing: SSM: SendCommand permission... "
    COMMAND_ID=$(aws ssm send-command \
        --instance-ids "$STAGING_INSTANCE" \
        --document-name "AWS-RunShellScript" \
        --parameters 'commands=["echo test"]' \
        --profile jordan \
        --query 'Command.CommandId' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$COMMAND_ID" ]; then
        echo -e "${GREEN}✅${NC}"
        echo "   Command ID: $COMMAND_ID (you can cancel it in AWS Console if needed)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${YELLOW}⚠️  Staging instance not found or not running${NC}"
fi

echo ""
echo "=========================================="
echo "📊 Summary"
echo "=========================================="
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
    echo ""
    echo "⚠️  Some tests failed. Check the errors above."
    exit 1
else
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "💡 Next step: Run 'terraform plan' to verify Terraform can read all resources"
    echo "   cd devops/terraform && terraform plan -no-color | head -50"
    exit 0
fi


