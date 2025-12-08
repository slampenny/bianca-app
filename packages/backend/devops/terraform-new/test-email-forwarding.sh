#!/bin/bash
# Comprehensive test script for email forwarding setup
# Usage: ./test-email-forwarding.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "corp-email-forwarding.tf" ]; then
  echo -e "${RED}Error: Must run from devops/terraform-new directory${NC}"
  exit 1
fi

echo "=== Testing Email Forwarding Setup ==="
echo ""

# 1. Check Terraform outputs
echo "1. Checking Terraform outputs..."
BUCKET=$(terraform output -raw corp_email_s3_bucket_name 2>/dev/null || echo "")
LAMBDA=$(terraform output -raw corp_email_lambda_function_name 2>/dev/null || echo "")

if [ -z "$BUCKET" ] || [ -z "$LAMBDA" ]; then
  echo -e "${YELLOW}⚠️  Terraform outputs not available. Run 'terraform apply' first.${NC}"
  echo "   Continuing with basic checks..."
  BUCKET="bianca-corp-email-storage-730335291008"  # Default from config
  LAMBDA="bianca-corp-email-forwarder"  # Default from config
else
  echo -e "${GREEN}✅ S3 Bucket: $BUCKET${NC}"
  echo -e "${GREEN}✅ Lambda: $LAMBDA${NC}"
fi

# 2. Check AWS resources exist
echo ""
echo "2. Checking AWS resources..."
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo -e "${GREEN}✅ S3 bucket exists: $BUCKET${NC}"
else
  echo -e "${RED}❌ S3 bucket not found: $BUCKET${NC}"
  echo "   Run 'terraform apply' to create resources"
fi

if aws lambda get-function --function-name "$LAMBDA" >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Lambda function exists: $LAMBDA${NC}"
  
  # Get Lambda configuration
  echo ""
  echo "3. Checking Lambda configuration..."
  MAPPINGS=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA" \
    --query 'Environment.Variables.EMAIL_MAPPINGS' \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$MAPPINGS" ] && [[ "$MAPPINGS" == *"jlapp@biancatechnologies.com"* ]]; then
    echo -e "${GREEN}✅ Email mappings configured${NC}"
    echo "   Mappings: $MAPPINGS"
  else
    echo -e "${YELLOW}⚠️  Email mappings not found or incorrect${NC}"
    echo "   Current: $MAPPINGS"
  fi
else
  echo -e "${RED}❌ Lambda function not found: $LAMBDA${NC}"
  echo "   Run 'terraform apply' to create resources"
fi

# 4. Check SES domain verification
echo ""
echo "4. Checking SES domain verification..."
VERIFICATION=$(aws ses get-identity-verification-attributes \
  --identities biancatechnologies.com \
  --query 'VerificationAttributes.biancatechnologies.com.VerificationStatus' \
  --output text 2>/dev/null || echo "Unknown")

case "$VERIFICATION" in
  "Success")
    echo -e "${GREEN}✅ Domain verified in SES${NC}"
    ;;
  "Pending")
    echo -e "${YELLOW}⚠️  Domain verification pending${NC}"
    echo "   Add DNS records from Terraform outputs"
    ;;
  "Failed"|"TemporaryFailure")
    echo -e "${RED}❌ Domain verification failed${NC}"
    echo "   Check DNS records"
    ;;
  *)
    echo -e "${YELLOW}⚠️  Domain verification status: $VERIFICATION${NC}"
    echo "   Domain may not be configured in SES yet"
    ;;
esac

# 5. Check DNS records
echo ""
echo "5. Checking DNS records (basic check)..."
MX_RECORD=$(dig +short MX biancatechnologies.com 2>/dev/null | head -1 || echo "")
if [[ "$MX_RECORD" == *"amazonses"* ]] || [[ "$MX_RECORD" == *"amazonaws"* ]]; then
  echo -e "${GREEN}✅ MX record configured: $MX_RECORD${NC}"
else
  echo -e "${YELLOW}⚠️  MX record may not be configured correctly${NC}"
  echo "   Expected: inbound-smtp.*.amazonaws.com"
  echo "   Found: $MX_RECORD"
fi

# 6. Check recent CloudWatch logs
echo ""
echo "6. Checking recent Lambda invocations..."
LOG_GROUP="/aws/lambda/$LAMBDA"
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" >/dev/null 2>&1; then
  RECENT_LOGS=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time $(($(date +%s) - 3600))000 \
    --max-items 1 \
    --query 'events[0].message' \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$RECENT_LOGS" ] && [ "$RECENT_LOGS" != "None" ]; then
    echo -e "${GREEN}✅ Recent Lambda activity found${NC}"
    echo "   Latest: $(echo "$RECENT_LOGS" | cut -c1-80)..."
  else
    echo -e "${YELLOW}ℹ️  No recent Lambda invocations (OK if no emails sent)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Log group not found (Lambda may not have been invoked yet)${NC}"
fi

# 7. Check S3 for stored emails
echo ""
echo "7. Checking for stored emails in S3..."
EMAIL_COUNT=$(aws s3 ls "s3://$BUCKET/emails/" --recursive 2>/dev/null | wc -l || echo "0")
if [ "$EMAIL_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ Found $EMAIL_COUNT email(s) stored in S3${NC}"
else
  echo -e "${YELLOW}ℹ️  No emails stored yet (OK if no emails received)${NC}"
fi

# 8. Check SES receipt rules
echo ""
echo "8. Checking SES receipt rules..."
RULE_SET=$(aws ses describe-active-receipt-rule-set \
  --query 'Metadata.RuleSetName' \
  --output text 2>/dev/null || echo "")

if [[ "$RULE_SET" == *"bianca-corp"* ]]; then
  echo -e "${GREEN}✅ Active receipt rule set: $RULE_SET${NC}"
else
  echo -e "${YELLOW}⚠️  Receipt rule set may not be active${NC}"
  echo "   Expected: bianca-corp-email-forwarding"
  echo "   Current: $RULE_SET"
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo ""
echo "Next steps to test end-to-end:"
echo "1. Ensure DNS records are added (MX, SPF, DKIM, DMARC)"
echo "2. Wait for domain verification in SES (check console)"
echo "3. If in SES sandbox, verify a test email address:"
echo "   aws ses verify-email-identity --email-address your-email@gmail.com"
echo "4. Send a test email to jlapp@biancatechnologies.com"
echo "5. Monitor logs: aws logs tail /aws/lambda/$LAMBDA --follow"
echo "6. Check that email arrives at negascout@gmail.com"
echo ""
echo "For detailed testing, see TEST_EMAIL_FORWARDING.md"





