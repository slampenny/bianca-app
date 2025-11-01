#!/usr/bin/env bash
# Script to diagnose SES email authentication issues
# Usage: ./check-ses-auth.sh [aws-profile] [aws-region]

set -euo pipefail

AWS_PROFILE="${1:-jordan}"
AWS_REGION="${2:-us-east-2}"
EMAIL_FROM="${EMAIL_FROM:-support@myphonefriend.com}"

echo "=========================================="
echo "SES Email Authentication Diagnostic Script"
echo "=========================================="
echo "Profile: $AWS_PROFILE"
echo "Region: $AWS_REGION"
echo "From Address: $EMAIL_FROM"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}✗${NC} $1 not found. Please install it."
        return 1
    fi
    return 0
}

echo "Checking prerequisites..."
check_command aws
check_command jq
echo ""

echo "=========================================="
echo "1. Checking SES Email Identity Status"
echo "=========================================="
IDENTITY_CHECK=$(aws ses get-identity-verification-attributes \
  --identities "$EMAIL_FROM" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json 2>&1 || echo "ERROR")

if echo "$IDENTITY_CHECK" | grep -q "ERROR"; then
    echo -e "${RED}✗${NC} Failed to check identity: $IDENTITY_CHECK"
else
    STATUS=$(echo "$IDENTITY_CHECK" | jq -r ".VerificationAttributes.\"$EMAIL_FROM\".VerificationStatus // \"NotVerified\"")
    if [ "$STATUS" == "Success" ]; then
        echo -e "${GREEN}✓${NC} Email identity '$EMAIL_FROM' is verified (Status: $STATUS)"
    else
        echo -e "${YELLOW}⚠${NC} Email identity '$EMAIL_FROM' is NOT verified (Status: $STATUS)"
        echo "   Run: aws ses verify-email-identity --email-address $EMAIL_FROM --region $AWS_REGION --profile $AWS_PROFILE"
    fi
fi

echo ""
echo "=========================================="
echo "2. Checking SES Domain Identity Status"
echo "=========================================="
DOMAIN_CHECK=$(aws ses get-identity-verification-attributes \
  --identities myphonefriend.com \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json 2>&1 || echo "ERROR")

if echo "$DOMAIN_CHECK" | grep -q "ERROR"; then
    echo -e "${RED}✗${NC} Failed to check domain: $DOMAIN_CHECK"
else
    STATUS=$(echo "$DOMAIN_CHECK" | jq -r ".VerificationAttributes.\"myphonefriend.com\".VerificationStatus // \"NotVerified\"")
    if [ "$STATUS" == "Success" ]; then
        echo -e "${GREEN}✓${NC} Domain 'myphonefriend.com' is verified (Status: $STATUS)"
    else
        echo -e "${YELLOW}⚠${NC} Domain 'myphonefriend.com' is NOT verified (Status: $STATUS)"
    fi
fi

echo ""
echo "=========================================="
echo "3. Checking SES Account Status (Sandbox/Production)"
echo "=========================================="
ACCOUNT_CHECK=$(aws sesv2 get-account \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json 2>&1 || echo "ERROR")

if echo "$ACCOUNT_CHECK" | grep -q "ERROR"; then
    echo -e "${YELLOW}⚠${NC} Could not check account status (may need sesv2:GetAccount permission)"
else
    PROD_ACCESS=$(echo "$ACCOUNT_CHECK" | jq -r '.ProductionAccessEnabled // false')
    if [ "$PROD_ACCESS" == "true" ]; then
        echo -e "${GREEN}✓${NC} SES is in Production mode (can send to any email)"
    else
        echo -e "${YELLOW}⚠${NC} SES is in Sandbox mode (can only send to verified addresses)"
    fi
fi

echo ""
echo "=========================================="
echo "4. Checking ECS Task Definition"
echo "=========================================="
# Try to find task definition - may vary by environment
TASK_DEF_NAME="bianca-app-task"
TASK_DEF_CHECK=$(aws ecs list-task-definitions \
  --family-prefix "$TASK_DEF_NAME" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --max-items 1 \
  --output json 2>&1 || echo "ERROR")

if echo "$TASK_DEF_CHECK" | grep -q "ERROR"; then
    echo -e "${YELLOW}⚠${NC} Could not list task definitions (may need ecs:ListTaskDefinitions permission)"
    echo "   Trying to describe specific task definition..."
    TASK_DEF_NAME_FULL="$TASK_DEF_NAME"
else
    TASK_DEF_NAME_FULL=$(echo "$TASK_DEF_CHECK" | jq -r '.taskDefinitionArns[0] // ""')
fi

if [ -n "$TASK_DEF_NAME_FULL" ] && [ "$TASK_DEF_NAME_FULL" != "ERROR" ]; then
    TASK_ROLE_CHECK=$(aws ecs describe-task-definition \
      --task-definition "$TASK_DEF_NAME_FULL" \
      --region "$AWS_REGION" \
      --profile "$AWS_PROFILE" \
      --query 'taskDefinition.taskRoleArn' \
      --output text 2>&1 || echo "ERROR")
    
    if echo "$TASK_ROLE_CHECK" | grep -q "ERROR"; then
        echo -e "${YELLOW}⚠${NC} Could not get task role ARN"
    elif [ -n "$TASK_ROLE_CHECK" ] && [ "$TASK_ROLE_CHECK" != "None" ]; then
        echo -e "${GREEN}✓${NC} Task definition has task_role_arn: $TASK_ROLE_CHECK"
        TASK_ROLE_NAME=$(echo "$TASK_ROLE_CHECK" | awk -F'/' '{print $NF}')
        
        echo ""
        echo "=========================================="
        echo "5. Checking IAM Role Permissions"
        echo "=========================================="
        # Check if SES policy is attached
        ATTACHED_POLICIES=$(aws iam list-attached-role-policies \
          --role-name "$TASK_ROLE_NAME" \
          --profile "$AWS_PROFILE" \
          --output json 2>&1 || echo "ERROR")
        
        if echo "$ATTACHED_POLICIES" | grep -q "ERROR"; then
            echo -e "${YELLOW}⚠${NC} Could not list attached policies (need iam:ListAttachedRolePolicies permission)"
        else
            SES_POLICY_FOUND=$(echo "$ATTACHED_POLICIES" | jq -r '.AttachedPolicies[] | select(.PolicyName == "ECSTaskSESPolicy") | .PolicyArn // empty')
            if [ -n "$SES_POLICY_FOUND" ]; then
                echo -e "${GREEN}✓${NC} SES policy 'ECSTaskSESPolicy' is attached to role '$TASK_ROLE_NAME'"
            else
                echo -e "${RED}✗${NC} SES policy 'ECSTaskSESPolicy' is NOT attached to role '$TASK_ROLE_NAME'"
                echo "   Available policies:"
                echo "$ATTACHED_POLICIES" | jq -r '.AttachedPolicies[] | "     - \(.PolicyName)"'
            fi
        fi
    else
        echo -e "${RED}✗${NC} Task definition does NOT have task_role_arn set!"
        echo "   This means the ECS task cannot assume an IAM role for SES permissions."
    fi
else
    echo -e "${YELLOW}⚠${NC} Could not find task definition '$TASK_DEF_NAME'"
fi

echo ""
echo "=========================================="
echo "6. Testing SES Connectivity"
echo "=========================================="
SES_TEST=$(aws ses get-send-quota \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json 2>&1 || echo "ERROR")

if echo "$SES_TEST" | grep -q "ERROR"; then
    ERROR_MSG=$(echo "$SES_TEST" | grep -o 'Error.*' || echo "$SES_TEST")
    echo -e "${RED}✗${NC} Failed to connect to SES: $ERROR_MSG"
    if echo "$ERROR_MSG" | grep -qi "unauthorized\|access denied\|forbidden"; then
        echo "   This indicates an IAM permissions issue."
    fi
else
    MAX_SEND=$(echo "$SES_TEST" | jq -r '.MaxSendRate // "unknown"')
    MAX_24H=$(echo "$SES_TEST" | jq -r '.Max24HourSend // "unknown"')
    SENT_24H=$(echo "$SES_TEST" | jq -r '.SentLast24Hours // "unknown"')
    echo -e "${GREEN}✓${NC} SES connectivity successful"
    echo "   Max send rate: $MAX_SEND emails/second"
    echo "   Max 24h send: $MAX_24H emails"
    echo "   Sent (24h): $SENT_24H emails"
fi

echo ""
echo "=========================================="
echo "Summary & Recommendations"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. If email identity is not verified, run Terraform apply to add the resource"
echo "2. Check CloudWatch logs for detailed error messages:"
echo "   aws logs tail /aws/ecs/bianca-app --follow --profile $AWS_PROFILE"
echo "3. Test email sending after fixes:"
echo "   node -e \"const emailService = require('./src/services/email.service'); emailService.initializeEmailTransport().then(() => emailService.sendEmail('test@example.com', 'Test', 'Test body')).catch(err => console.error(err));\""
echo ""
echo "Terraform changes needed:"
echo "- Email identity resource added to main.tf"
echo "- Nodemailer SES config fixed in email.service.js"
echo "- Run: terraform apply to apply changes"

