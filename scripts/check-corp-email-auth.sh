#!/usr/bin/env bash
# Script to diagnose SES authentication for biancatechnologies.com emails
# Usage: ./check-corp-email-auth.sh [aws-profile] [aws-region] [email@biancatechnologies.com]

set -euo pipefail

AWS_PROFILE="${1:-jordan}"
AWS_REGION="${2:-us-east-2}"
TEST_EMAIL="${3:-jlapp@biancatechnologies.com}"
CORP_DOMAIN="biancatechnologies.com"

echo "=========================================="
echo "BiancaTech Email Authentication Diagnostic"
echo "=========================================="
echo "Profile: $AWS_PROFILE"
echo "Region: $AWS_REGION"
echo "Domain: $CORP_DOMAIN"
echo "Test Email: $TEST_EMAIL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "1. Checking SES Domain Identity Status"
echo "=========================================="
DOMAIN_CHECK=$(aws ses get-identity-verification-attributes \
  --identities "$CORP_DOMAIN" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json 2>&1 || echo "ERROR")

if echo "$DOMAIN_CHECK" | grep -q "ERROR"; then
    echo -e "${RED}✗${NC} Failed to check domain: $DOMAIN_CHECK"
else
    STATUS=$(echo "$DOMAIN_CHECK" | jq -r ".VerificationAttributes.\"$CORP_DOMAIN\".VerificationStatus // \"NotVerified\"")
    if [ "$STATUS" == "Success" ]; then
        echo -e "${GREEN}✓${NC} Domain '$CORP_DOMAIN' is verified (Status: $STATUS)"
        
        # Check DKIM status
        DKIM_STATUS=$(aws ses get-identity-dkim-attributes \
          --identities "$CORP_DOMAIN" \
          --region "$AWS_REGION" \
          --profile "$AWS_PROFILE" \
          --query "DkimAttributes.$CORP_DOMAIN.DkimEnabled" \
          --output text 2>&1 || echo "false")
        
        if [ "$DKIM_STATUS" == "true" ]; then
            echo -e "${GREEN}✓${NC} DKIM is enabled for domain"
        else
            echo -e "${YELLOW}⚠${NC} DKIM is not enabled"
        fi
    else
        echo -e "${RED}✗${NC} Domain '$CORP_DOMAIN' is NOT verified (Status: $STATUS)"
        echo "   This is the likely cause of authentication failures!"
        echo "   Run: cd devops/terraform && terraform apply"
    fi
fi

echo ""
echo "=========================================="
echo "2. Checking SES Email Identity (if domain not verified)"
echo "=========================================="
EMAIL_CHECK=$(aws ses get-identity-verification-attributes \
  --identities "$TEST_EMAIL" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json 2>&1 || echo "ERROR")

if echo "$EMAIL_CHECK" | grep -q "ERROR"; then
    echo -e "${YELLOW}⚠${NC} Could not check email identity"
else
    STATUS=$(echo "$EMAIL_CHECK" | jq -r ".VerificationAttributes.\"$TEST_EMAIL\".VerificationStatus // \"NotVerified\"")
    if [ "$STATUS" == "Success" ]; then
        echo -e "${GREEN}✓${NC} Email '$TEST_EMAIL' is verified (Status: $STATUS)"
    else
        echo -e "${YELLOW}⚠${NC} Email '$TEST_EMAIL' is NOT verified (Status: $STATUS)"
        echo "   Note: If domain is verified, emails are auto-verified"
    fi
fi

echo ""
echo "=========================================="
echo "3. Checking IAM User for SMTP"
echo "=========================================="
LOCALPART=$(echo "$TEST_EMAIL" | awk -F'@' '{print tolower($1)}')
IAM_USER="ses-smtp-${LOCALPART}"

USER_EXISTS=$(aws iam get-user \
  --user-name "$IAM_USER" \
  --profile "$AWS_PROFILE" \
  --output json 2>&1 || echo "ERROR")

if echo "$USER_EXISTS" | grep -q "ERROR"; then
    echo -e "${YELLOW}⚠${NC} IAM user '$IAM_USER' does not exist"
    echo "   Run: ./corp-email.sh create-smtp $TEST_EMAIL"
else
    echo -e "${GREEN}✓${NC} IAM user '$IAM_USER' exists"
    
    # Check attached policies
    echo "   Checking user policies..."
    POLICIES=$(aws iam list-user-policies \
      --user-name "$IAM_USER" \
      --profile "$AWS_PROFILE" \
      --output json 2>&1 || echo "{}")
    
    SES_POLICY=$(echo "$POLICIES" | jq -r '.PolicyNames[] | select(. == "ses-send-only") // empty')
    if [ -n "$SES_POLICY" ]; then
        echo -e "${GREEN}✓${NC} User has 'ses-send-only' policy"
        
        # Check policy content
        POLICY_DOC=$(aws iam get-user-policy \
          --user-name "$IAM_USER" \
          --policy-name "ses-send-only" \
          --profile "$AWS_PROFILE" \
          --query 'PolicyDocument' \
          --output json 2>&1 || echo "{}")
        
        # Check if domain ARN is in the policy
        DOMAIN_ARN="arn:aws:ses:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):identity/${CORP_DOMAIN}"
        if echo "$POLICY_DOC" | jq -e --arg arn "$DOMAIN_ARN" '.Statement[0].Resource[]? == $arn' >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Policy includes domain ARN: $DOMAIN_ARN"
        else
            echo -e "${YELLOW}⚠${NC} Policy may not include domain-specific ARN"
            echo "   Policy should include: $DOMAIN_ARN"
        fi
    else
        echo -e "${RED}✗${NC} User does NOT have 'ses-send-only' policy"
    fi
    
    # Check access keys
    KEYS=$(aws iam list-access-keys \
      --user-name "$IAM_USER" \
      --profile "$AWS_PROFILE" \
      --output json 2>&1 || echo "{}")
    
    KEY_COUNT=$(echo "$KEYS" | jq '.AccessKeyMetadata | length')
    if [ "$KEY_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} User has $KEY_COUNT access key(s)"
    else
        echo -e "${RED}✗${NC} User has no access keys!"
        echo "   Run: ./corp-email.sh create-smtp $TEST_EMAIL"
    fi
fi

echo ""
echo "=========================================="
echo "4. Checking SMTP Credentials in Secrets Manager"
echo "=========================================="
SECRET_NAME="ses/smtp/${LOCALPART}"
SECRET_CHECK=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'SecretString' \
  --output text 2>&1 || echo "ERROR")

if echo "$SECRET_CHECK" | grep -q "ERROR"; then
    echo -e "${RED}✗${NC} Secret '$SECRET_NAME' does not exist"
    echo "   Run: ./corp-email.sh create-smtp $TEST_EMAIL"
else
    echo -e "${GREEN}✓${NC} Secret '$SECRET_NAME' exists"
    SERVER=$(echo "$SECRET_CHECK" | jq -r '.server // "unknown"')
    PORT=$(echo "$SECRET_CHECK" | jq -r '.port // "unknown"')
    USERNAME=$(echo "$SECRET_CHECK" | jq -r '.username // "unknown"')
    echo "   Server: $SERVER"
    echo "   Port: $PORT"
    echo "   Username: $USERNAME"
fi

echo ""
echo "=========================================="
echo "5. Testing SMTP Authentication"
echo "=========================================="
if [ -n "$SECRET_CHECK" ] && ! echo "$SECRET_CHECK" | grep -q "ERROR"; then
    SERVER=$(echo "$SECRET_CHECK" | jq -r '.server')
    PORT=$(echo "$SECRET_CHECK" | jq -r '.port')
    USERNAME=$(echo "$SECRET_CHECK" | jq -r '.username')
    PASSWORD=$(echo "$SECRET_CHECK" | jq -r '.password')
    
    echo "Attempting SMTP connection test..."
    python3 <<EOF
import smtplib
import sys

server = "$SERVER"
port = int("$PORT")
username = "$USERNAME"
password = "$PASSWORD"

try:
    print("Connecting to SMTP server...")
    smtp = smtplib.SMTP(server, port)
    smtp.set_debuglevel(0)  # Set to 1 for verbose output
    
    print("Starting TLS...")
    smtp.starttls()
    
    print("Authenticating...")
    smtp.login(username, password)
    print("✓ Authentication successful!")
    
    smtp.quit()
    sys.exit(0)
except Exception as e:
    print(f"✗ Authentication failed: {e}")
    sys.exit(1)
EOF
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} SMTP authentication test passed"
    else
        echo -e "${RED}✗${NC} SMTP authentication test failed"
    fi
else
    echo -e "${YELLOW}⚠${NC} Cannot test SMTP - credentials not available"
fi

echo ""
echo "=========================================="
echo "6. Checking Route53 DNS Records"
echo "=========================================="
# Check for Route53 zone
ZONE_ID=$(aws route53 list-hosted-zones \
  --profile "$AWS_PROFILE" \
  --query "HostedZones[?Name=='${CORP_DOMAIN}.'].Id" \
  --output text 2>&1 | cut -d'/' -f3 || echo "")

if [ -z "$ZONE_ID" ]; then
    echo -e "${YELLOW}⚠${NC} Route53 hosted zone not found for $CORP_DOMAIN"
    echo "   DNS records may be managed elsewhere"
else
    echo -e "${GREEN}✓${NC} Route53 zone found: $ZONE_ID"
    
    # Check verification record
    VERIFICATION=$(aws route53 list-resource-record-sets \
      --hosted-zone-id "$ZONE_ID" \
      --profile "$AWS_PROFILE" \
      --query "ResourceRecordSets[?Name=='_amazonses.${CORP_DOMAIN}.']" \
      --output json 2>&1 || echo "[]")
    
    if echo "$VERIFICATION" | jq -e '. | length > 0' >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} SES verification TXT record exists"
    else
        echo -e "${RED}✗${NC} SES verification TXT record missing!"
        echo "   Should be: _amazonses.$CORP_DOMAIN"
    fi
fi

echo ""
echo "=========================================="
echo "Summary & Recommendations"
echo "=========================================="
echo ""
echo "Most common issues:"
echo "1. Domain not verified in SES - run terraform apply"
echo "2. DNS records not propagated - wait 5-60 minutes"
echo "3. IAM user missing or policy incorrect - run corp-email.sh create-smtp"
echo "4. SMTP credentials outdated - regenerate with corp-email.sh create-smtp"
echo ""
echo "Next steps:"
echo "1. If domain not verified: cd devops/terraform && terraform apply"
echo "2. Check DNS: dig TXT _amazonses.$CORP_DOMAIN"
echo "3. Regenerate SMTP creds: ./corp-email.sh create-smtp $TEST_EMAIL"
echo "4. Test SMTP: Use the test-smtp-connection.sh script"

