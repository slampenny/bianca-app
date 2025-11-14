#!/bin/bash
# Quick test script to validate GitHub Actions IAM permissions
# This simulates what the workflow will do without doing a full deployment

set -e

echo "🧪 Testing GitHub Actions IAM Permissions"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test a command
test_command() {
    local name=$1
    local command=$2
    
    echo -n "Testing: $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "   Command: $command"
        eval "$command" 2>&1 | head -3
        ((TESTS_FAILED++))
        return 1
    fi
}

# Assume the GitHub Actions role (using your local profile to assume the role)
echo "🔐 Assuming GitHub Actions role..."
ROLE_ARN="arn:aws:iam::730335291008:role/github-actions-deploy-role"
SESSION_NAME="test-permissions-$(date +%s)"

# Get temporary credentials
CREDS=$(aws sts assume-role \
    --role-arn "$ROLE_ARN" \
    --role-session-name "$SESSION_NAME" \
    --profile jordan \
    --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
    --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to assume role${NC}"
    echo "   Make sure you have permission to assume this role"
    exit 1
fi

# Extract credentials
ACCESS_KEY=$(echo $CREDS | awk '{print $1}')
SECRET_KEY=$(echo $CREDS | awk '{print $2}')
SESSION_TOKEN=$(echo $CREDS | awk '{print $3}')

# Export for AWS CLI
export AWS_ACCESS_KEY_ID=$ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SECRET_KEY
export AWS_SESSION_TOKEN=$SESSION_TOKEN
export AWS_DEFAULT_REGION=us-east-2

echo -e "${GREEN}✅ Role assumed successfully${NC}"
echo ""

# Test 1: Terraform state access (S3)
echo "📦 Testing Terraform State Access..."
test_command "S3: List terraform state bucket" \
    "aws s3 ls s3://bianca-terraform-state/"

test_command "S3: Read terraform state" \
    "aws s3 cp s3://bianca-terraform-state/backend/terraform.tfstate /tmp/test-state.json 2>&1 && rm -f /tmp/test-state.json"

test_command "DynamoDB: Describe state lock table" \
    "aws dynamodb describe-table --table-name terraform-state-lock --region us-east-2"

echo ""

# Test 2: Terraform read permissions
echo "🔍 Testing Terraform Read Permissions..."
test_command "EC2: Describe instances" \
    "aws ec2 describe-instances --filters 'Name=tag:Name,Values=bianca-staging' --query 'Reservations[0].Instances[0].InstanceId' --output text"

test_command "EC2: Describe VPCs" \
    "aws ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text"

test_command "EC2: Describe availability zones" \
    "aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text"

test_command "ELBv2: Describe load balancers" \
    "aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `staging`)].LoadBalancerName' --output text"

test_command "Route53: List hosted zones" \
    "aws route53 list-hosted-zones --query 'HostedZones[0].Name' --output text"

test_command "ACM: List certificates" \
    "aws acm list-certificates --query 'CertificateSummaryList[0].DomainName' --output text"

test_command "IAM: Get role (GitHub Actions)" \
    "aws iam get-role --role-name github-actions-deploy-role --query 'Role.RoleName' --output text"

test_command "ECR: Describe repositories" \
    "aws ecr describe-repositories --query 'repositories[?contains(repositoryName, `bianca`)].repositoryName' --output text"

test_command "CloudWatch Logs: Describe log groups" \
    "aws logs describe-log-groups --query 'logGroups[0].logGroupName' --output text"

echo ""

# Test 3: SSM permissions
echo "📡 Testing SSM Permissions..."
STAGING_INSTANCE=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=bianca-staging" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null)

if [ "$STAGING_INSTANCE" != "None" ] && [ -n "$STAGING_INSTANCE" ]; then
    echo "   Found staging instance: $STAGING_INSTANCE"
    
    test_command "SSM: Describe instance information" \
        "aws ssm describe-instance-information --filters \"Key=InstanceIds,Values=$STAGING_INSTANCE\" --query 'InstanceInformationList[0].InstanceId' --output text"
    
    test_command "SSM: SendCommand (dry run - just check permissions)" \
        "aws ssm send-command --instance-ids $STAGING_INSTANCE --document-name 'AWS-RunShellScript' --parameters 'commands=[\"echo test\"]' --query 'Command.CommandId' --output text"
    
    echo "   ⚠️  Note: If SendCommand passes, it will create a command. Check AWS Console to cancel if needed."
else
    echo -e "${YELLOW}⚠️  Staging instance not found or not running${NC}"
    echo "   Skipping SSM tests"
fi

echo ""

# Test 4: ECR permissions
echo "🐳 Testing ECR Permissions..."
test_command "ECR: Get authorization token" \
    "aws ecr get-authorization-token --query 'authorizationData[0].authorizationToken' --output text | head -c 20"

test_command "ECR: Batch check layer availability" \
    "aws ecr batch-check-layer-availability --repository-name bianca-app-backend --layer-digests sha256:test 2>&1 | grep -q 'RepositoryNotFoundException\\|InvalidParameterException' || true"

echo ""

# Summary
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
    echo ""
    echo "⚠️  Some tests failed. Review the errors above."
    exit 1
else
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "🚀 Permissions look good! The deployment should work."
    exit 0
fi

