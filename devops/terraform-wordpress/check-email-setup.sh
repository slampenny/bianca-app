#!/bin/bash
# Diagnostic script to check WordPress email configuration

set -e

echo "=========================================="
echo "WordPress Email Setup Diagnostic"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI is not installed${NC}"
    exit 1
fi

# Get AWS region (default to us-east-2)
AWS_REGION=${AWS_REGION:-us-east-2}
DOMAIN="myphonefriend.com"

echo "Checking SES configuration for domain: $DOMAIN"
echo "Region: $AWS_REGION"
echo ""

# Check SES domain verification
echo "1. Checking SES Domain Verification..."
VERIFICATION=$(aws ses get-identity-verification-attributes \
    --identities "$DOMAIN" \
    --region "$AWS_REGION" \
    --query "VerificationAttributes.$DOMAIN.VerificationStatus" \
    --output text 2>/dev/null || echo "ERROR")

if [ "$VERIFICATION" == "Success" ]; then
    echo -e "${GREEN}✓ Domain is verified in SES${NC}"
else
    echo -e "${RED}✗ Domain is NOT verified in SES${NC}"
    echo "  Status: $VERIFICATION"
    echo "  Action: Verify the domain in AWS SES Console or via Terraform"
fi
echo ""

# Check SES sending status
echo "2. Checking SES Account Sending Status..."
SENDING_ENABLED=$(aws ses get-account-sending-enabled \
    --region "$AWS_REGION" \
    --query "Enabled" \
    --output text 2>/dev/null || echo "false")

if [ "$SENDING_ENABLED" == "true" ]; then
    echo -e "${GREEN}✓ SES sending is enabled${NC}"
else
    echo -e "${YELLOW}⚠ SES sending may be in sandbox mode${NC}"
    echo "  In sandbox mode, you can only send to verified email addresses"
    echo "  Action: Request production access in AWS SES Console"
fi
echo ""

# Check SES send quota
echo "3. Checking SES Send Quota..."
QUOTA=$(aws ses get-send-quota \
    --region "$AWS_REGION" \
    --query "Max24HourSend" \
    --output text 2>/dev/null || echo "0")

SENT=$(aws ses get-send-quota \
    --region "$AWS_REGION" \
    --query "SentLast24Hours" \
    --output text 2>/dev/null || echo "0")

if [ "$QUOTA" != "0" ]; then
    echo -e "${GREEN}✓ Send quota: $SENT / $QUOTA emails in last 24 hours${NC}"
else
    echo -e "${RED}✗ Could not retrieve send quota${NC}"
fi
echo ""

# Check if WordPress instance exists
echo "4. Checking WordPress EC2 Instance..."
INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=bianca-wordpress" "Name=instance-state-name,Values=running" \
    --region "$AWS_REGION" \
    --query "Reservations[0].Instances[0].InstanceId" \
    --output text 2>/dev/null || echo "NONE")

if [ "$INSTANCE_ID" != "NONE" ] && [ "$INSTANCE_ID" != "None" ]; then
    echo -e "${GREEN}✓ WordPress instance found: $INSTANCE_ID${NC}"
    
    # Check IAM role
    IAM_ROLE=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --query "Reservations[0].Instances[0].IamInstanceProfile.Arn" \
        --output text 2>/dev/null || echo "NONE")
    
    if [ "$IAM_ROLE" != "NONE" ] && [ "$IAM_ROLE" != "None" ]; then
        echo -e "${GREEN}✓ Instance has IAM role: $IAM_ROLE${NC}"
    else
        echo -e "${RED}✗ Instance does not have an IAM role${NC}"
    fi
else
    echo -e "${RED}✗ WordPress instance not found${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. If domain is not verified, check Route53 DNS records"
echo "2. If SES is in sandbox mode, request production access"
echo "3. Install and configure WP Mail SMTP plugin in WordPress"
echo "4. See WORDPRESS_EMAIL_SETUP.md for detailed instructions"
echo ""
echo "To test email sending from the WordPress instance:"
echo "  ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<instance-ip>"
echo "  aws ses send-email \\"
echo "    --from noreply@$DOMAIN \\"
echo "    --to your-email@example.com \\"
echo "    --subject 'Test Email' \\"
echo "    --text 'This is a test' \\"
echo "    --region $AWS_REGION"
echo ""




