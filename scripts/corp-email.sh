#!/usr/bin/env bash
set -euo pipefail

# Simple CLI to manage corporate email forwarding and SMTP creds
# Requirements: awscli v2, jq, python3

AWS_REGION="${AWS_REGION:-us-east-2}"
AWS_PROFILE="${AWS_PROFILE:-jordan}"
export AWS_REGION AWS_PROFILE
RULE_SET="myphonefriend-email-forwarding"
LAMBDA_NAME="myphonefriend-email-forwarder"
CORP_DOMAIN="biancatechnologies.com"
S3_BUCKET=""

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") create-smtp <user@biancatechnologies.com>
  $(basename "$0") set-mapping <user@biancatechnologies.com> <forward@gmail.com>
  $(basename "$0") add-rule <user@biancatechnologies.com>
  $(basename "$0") status <user@biancatechnologies.com>
  $(basename "$0") <localpart> <forward@gmail.com>   # one-shot bootstrap

Environment:
  AWS_REGION (default: ${AWS_REGION})
USAGE
}

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need aws; need jq; need python3

account_id=$(aws sts get-caller-identity --query Account --output text)
S3_BUCKET="bianca-corp-email-storage-${account_id}"

localpart() {
  local email="$1"; echo "$email" | awk -F'@' '{print tolower($1)}'
}

smtp_from_secret() {
  local secret_key_json="$1" # path to JSON with AccessKeyId/SecretAccessKey
  local region="$AWS_REGION" # Use AWS_REGION from environment
  python3 - "$secret_key_json" "$region" <<'PY'
# IMPORTANT: AWS SES SMTP uses a special password derivation algorithm
# that differs from standard AWS Signature v4 signing. Key differences:
# 1. Uses fixed date "11111111" instead of actual date
# 2. Always signs the message "SendRawEmail"
# 3. Prepends version byte 0x04 to the signature
# Reference: https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html

import json,sys,hmac,hashlib,base64

region = sys.argv[2]  # Get region from command line argument
data = json.load(open(sys.argv[1]))
sk = data['SecretAccessKey']

# AWS SES SMTP Constants - DO NOT CHANGE
DATE = "11111111"  # Fixed date for SMTP (not actual date!)
SERVICE = "ses"
MESSAGE = "SendRawEmail"
VERSION = 0x04

# Step 1: Create signing key using HMAC-SHA256 chain
# kSecret = "AWS4" + secret_access_key
k_secret = ("AWS4" + sk).encode('utf-8')

# kDate = HMAC(kSecret, "11111111") - NOTE: Fixed date, not actual date!
k_date = hmac.new(k_secret, DATE.encode('utf-8'), hashlib.sha256).digest()

# kRegion = HMAC(kDate, region)
k_region = hmac.new(k_date, region.encode('utf-8'), hashlib.sha256).digest()

# kService = HMAC(kRegion, "ses")
k_service = hmac.new(k_region, SERVICE.encode('utf-8'), hashlib.sha256).digest()

# kSigning = HMAC(kService, "aws4_request")
k_signing = hmac.new(k_service, "aws4_request".encode('utf-8'), hashlib.sha256).digest()

# Step 2: Sign the message "SendRawEmail"
signature = hmac.new(k_signing, MESSAGE.encode('utf-8'), hashlib.sha256).digest()

# Step 3: Prepend version byte (0x04) and base64 encode
signature_and_version = bytes([VERSION]) + signature
smtp_password = base64.b64encode(signature_and_version).decode('utf-8')

print(json.dumps({
    'SMTPUsername': data['AccessKeyId'],
    'SMTPPassword': smtp_password
}))
PY
}

create_smtp() {
  local email="$1"; local user="ses-smtp-$(localpart "$email")"
  echo "Creating/ensuring IAM user ${user}..."
  aws iam create-user --user-name "$user" >/dev/null 2>&1 || true
  # SES SMTP requires both SendEmail and SendRawEmail permissions
  # Get account ID for potential resource ARN scoping
  account_id=$(aws sts get-caller-identity --query Account --output text)
  # SES SMTP auth may require scoped permissions to the domain identity
  # Try scoping to domain ARN if it helps with authentication
  domain_arn="arn:aws:ses:${AWS_REGION}:${account_id}:identity/${CORP_DOMAIN}"
  cat > /tmp/ses-send-policy.json <<POL
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:GetSendQuota",
        "ses:GetSendStatistics"
      ],
      "Resource": [
        "*",
        "${domain_arn}"
      ]
    }
  ]
}
POL
  aws iam put-user-policy --user-name "$user" --policy-name ses-send-only --policy-document file:///tmp/ses-send-policy.json >/dev/null
  echo "Creating new access key (rotate if limit reached)..."
  # If user already has 2 keys, delete the oldest one to make room
  existing=$(aws iam list-access-keys --user-name "$user" --output json | jq -c '.AccessKeyMetadata | sort_by(.CreateDate)')
  count=$(echo "$existing" | jq 'length')
  if [ "$count" -ge 2 ]; then
    oldest=$(echo "$existing" | jq -r '.[0].AccessKeyId')
    echo "User has $count access keys; deleting oldest: $oldest"
    aws iam delete-access-key --user-name "$user" --access-key-id "$oldest" >/dev/null
  fi
  aws iam create-access-key --user-name "$user" \
    --query '{AccessKeyId:AccessKey.AccessKeyId,SecretAccessKey:AccessKey.SecretAccessKey}' \
    --output json > /tmp/ak.json
  echo "Deriving SMTP password..."
  smtp_json=$(smtp_from_secret /tmp/ak.json)
  smtp_user=$(echo "$smtp_json" | jq -r .SMTPUsername)
  smtp_pass=$(echo "$smtp_json" | jq -r .SMTPPassword)
  cat > /tmp/smtp.json <<JSON
{ "server":"email-smtp.${AWS_REGION}.amazonaws.com", "port":587, "username":"${smtp_user}", "password":"${smtp_pass}" }
JSON
  local secret="ses/smtp/$(localpart "$email")"
  aws secretsmanager create-secret --name "$secret" --secret-string file:///tmp/smtp.json --description "SES SMTP creds for $email" --output text >/dev/null 2>&1 || true
  aws secretsmanager update-secret --secret-id "$secret" --secret-string file:///tmp/smtp.json --output text >/dev/null
  echo "SMTP credentials stored in Secrets Manager: $secret"
  echo "Username: $smtp_user"
  echo "Password: (stored)"
}

set_mapping() {
  local email="$1"; local fwd="$2"
  echo "Updating Lambda RECIPIENT_MAP for $email -> $fwd"
  cfg=$(aws lambda get-function-configuration --function-name "$LAMBDA_NAME" --output json)
  map=$(echo "$cfg" | jq -r '.Environment.Variables.RECIPIENT_MAP // "{}"')
  new_map=$(echo "$map" | jq --arg k "$(echo "$email" | tr 'A-Z' 'a-z')" --arg v "$fwd" '. + {($k):$v}')
  aws lambda update-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --environment "Variables={FROM_DOMAIN=myphonefriend.com,RECIPIENT_MAP='${new_map}'}" >/dev/null
  echo "Updated mapping: $(echo "$new_map" | tr -d '\n')"
}

add_rule() {
  local email="$1"; local lp=$(localpart "$email")
  echo "Ensuring SES receipt rule for $email in $RULE_SET"
  
  # Check if rule already exists for this recipient (with better error handling)
  local existing_check
  existing_check=$(aws ses describe-receipt-rule-set \
    --rule-set-name "$RULE_SET" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --output json 2>&1)
  
  # Check both by recipient email AND by rule name (rule name is corp-<localpart>)
  if echo "$existing_check" | jq -e --arg email "$email" '.Rules[]? | select(.Recipients[]? == $email)' >/dev/null 2>&1; then
    echo "Rule already exists for $email"
    echo "Rule ensured: corp-${lp}"
    return 0
  fi
  
  # Also check by rule name in case recipient check didn't work
  if echo "$existing_check" | jq -e --arg name "corp-${lp}" '.Rules[]? | select(.Name == $name)' >/dev/null 2>&1; then
    echo "Rule already exists (found by name: corp-${lp})"
    echo "Rule ensured: corp-${lp}"
    return 0
  fi
  
  # Create S3 bucket policy to allow SES puts
  cat > /tmp/bucket-policy.json <<JSON
{ "Version":"2012-10-17", "Statement":[{"Sid":"AllowSESPuts","Effect":"Allow","Principal":{"Service":"ses.amazonaws.com"},"Action":"s3:PutObject","Resource":"arn:aws:s3:::${S3_BUCKET}/*","Condition":{"StringEquals":{"aws:Referer":"${account_id}"}}}]}
JSON
  aws s3api put-bucket-policy \
    --bucket "$S3_BUCKET" \
    --policy file:///tmp/bucket-policy.json \
    --profile "$AWS_PROFILE" \
    >/dev/null 2>&1 || true
  
  # Prepare rule payload
  rule_payload=$(jq -c \
    --arg email "$email" \
    --arg bucket "$S3_BUCKET" \
    --arg pref "corp/${lp}/" \
    --arg fn "arn:aws:lambda:${AWS_REGION}:${account_id}:function:${LAMBDA_NAME}" \
    '{Name: ("corp-"+($email|split("@")[0])), Enabled:true, TlsPolicy:"Optional", Recipients:[$email], Actions:[{S3Action:{BucketName:$bucket, ObjectKeyPrefix:$pref}},{LambdaAction:{FunctionArn:$fn,InvocationType:"Event"}}] }')
  
  echo "Creating receipt rule..."
  # Create with explicit timeout and error handling
  # Use both shell timeout and AWS CLI timeout flags to prevent hanging
  local create_result
  create_result=$(timeout 15 aws ses create-receipt-rule \
    --rule-set-name "$RULE_SET" \
    --rule "$rule_payload" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --cli-read-timeout 10 \
    --cli-connect-timeout 5 \
    2>&1)
  local create_exit=$?
  
  if [ $create_exit -eq 124 ]; then
    echo "Warning: create-receipt-rule timed out after 15 seconds"
    echo "This may indicate a permissions issue or AWS API problem"
    echo "Checking if rule was actually created despite timeout..."
  elif [ $create_exit -ne 0 ]; then
    # Check if error is "already exists" - this is actually success!
    if echo "$create_result" | grep -qi "already exists\|duplicate\|AlreadyExists"; then
      echo "Rule already exists (detected via error message) - this is OK"
      create_exit=0  # Treat as success
    else
      echo "Error creating rule: $create_result"
      echo "This may be a permissions issue. Check:"
      echo "  - Lambda function exists: $LAMBDA_NAME"
      echo "  - S3 bucket exists: $S3_BUCKET"
      echo "  - Lambda has permission for SES to invoke it"
    fi
  else
    echo "Rule created successfully"
  fi
  
  # Verify rule exists (with retry)
  sleep 1  # Give AWS time to propagate
  local verify_result
  verify_result=$(aws ses describe-receipt-rule-set \
    --rule-set-name "$RULE_SET" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --output json 2>&1)
  
  if echo "$verify_result" | jq -e --arg email "$email" '.Rules[]? | select(.Recipients[]? == $email)' >/dev/null 2>&1; then
    echo "Rule ensured: corp-${lp}"
  else
    echo "Warning: could not confirm rule creation after verification"
    echo ""
    echo "To create manually, run:"
    echo "aws --profile $AWS_PROFILE --region $AWS_REGION ses create-receipt-rule --rule-set-name $RULE_SET --rule '$rule_payload'"
    echo ""
    echo "Or skip rule creation and use: ./corp-email.sh set-mapping $email <forward-email>"
    return 1
  fi
}

status() {
  local email="$1"; local lp=$(localpart "$email")
  echo "DNS (Route53) for ${CORP_DOMAIN}:"; \
  aws route53 list-resource-record-sets --hosted-zone-id $(aws route53 list-hosted-zones --query "HostedZones[?Name=='${CORP_DOMAIN}.'].Id" --output text | cut -d'/' -f3) \
    --query "ResourceRecordSets[?ends_with(Name,'${CORP_DOMAIN}.')].[Type,Name,ResourceRecords[0].Value]" --output table || true
  echo; echo "SES identity:"; aws sesv2 get-email-identity --email-identity "$CORP_DOMAIN" --query '{Verified:VerifiedForSendingStatus,Dkim:DkimAttributes.Status}' --output table || true
  echo; echo "Rule present?"; aws ses describe-receipt-rule-set --rule-set-name "$RULE_SET" --output json | jq -r ".Rules[] | select(.Recipients[]? == \"$email\") | {Name,Recipients}" || true
  echo; echo "Lambda mapping:"; aws lambda get-function-configuration --function-name "$LAMBDA_NAME" --query 'Environment.Variables.RECIPIENT_MAP' --output text || true
}

bootstrap() {
  local lp="$1"; local forward="$2"; local email="${lp}@${CORP_DOMAIN}"
  echo "== Bootstrap: $email -> $forward =="
  create_smtp "$email"
  set_mapping "$email" "$forward"
  add_rule "$email"
  # Fetch SMTP creds for email content
  local secret="ses/smtp/${lp}"
  local smtp_json=$(aws secretsmanager get-secret-value --secret-id "$secret" --query SecretString --output text)
  local server=$(echo "$smtp_json" | jq -r .server)
  local port=$(echo "$smtp_json" | jq -r .port)
  local username=$(echo "$smtp_json" | jq -r .username)
  local password=$(echo "$smtp_json" | jq -r .password)
  # Compose instructions email
  local subject="Your biancatechnologies.com SMTP credentials"
  local body=$(cat <<TXT
Hi,

Your biancatechnologies.com address has been set up:
  Address: ${email}
  Forwards to: ${forward}

Gmail "Send mail as" setup:
  1) Gmail → Settings → Accounts and Import → Send mail as → Add another email address
  2) Email: ${email}; Uncheck "Treat as an alias"
  3) SMTP server: ${server}
     Port: ${port} (TLS)
     Username: ${username}
     Password: ${password}
  4) Verify using the code sent to ${email} (it will arrive in your inbox via forwarding)
  5) In Accounts and Import, set "Reply from the same address the message was sent to"

Notes:
  - This account uses AWS SES; SPF/DKIM/DMARC are configured.
  - Keep these credentials secure. You can rotate them anytime.

Thanks,
Bianca Admin
TXT
)
  echo "Sending credentials email to ${forward}..."
  # Always print credentials locally for the admin
  echo "\n===== SMTP CREDENTIALS (displayed for setup) ====="
  echo "Server: ${server}"
  echo "Port:   ${port}"
  echo "User:   ${username}"
  echo "Pass:   ${password}"
  echo "===============================================\n"

  # Only send notification email if SES is out of sandbox
  prod=$(aws sesv2 get-account --query ProductionAccessEnabled --output text 2>/dev/null || echo "False")
  if [[ "$prod" == "True" ]]; then
    # Build message JSON safely (preserves newlines)
    local msg_json
    msg_json=$(printf "%s" "$body" | jq -Rs --arg s "$subject" '{Subject:{Data:$s},Body:{Text:{Data:.}}}')
    # Use the root domain for FROM address to avoid MAIL FROM domain issues
    aws ses send-email \
      --from "${email}" \
      --destination "ToAddresses=${forward}" \
      --message "$msg_json" >/dev/null || true
    echo "Bootstrap complete and credentials sent via SES."
  else
    echo "SES is in sandbox; skipping notification email."
    echo "Ask recipient to configure Gmail using the credentials above, or verify their address in SES / request production access."
    echo "Bootstrap complete."
  fi
}

cmd="${1:-}"; shift || true
# If user called: ./corp-email.sh <localpart> <forward@gmail.com>
# and not a verb, treat as bootstrap
if [[ "$cmd" != "create-smtp" && "$cmd" != "set-mapping" && "$cmd" != "add-rule" && "$cmd" != "status" && -n "$cmd" && -n "${1:-}" ]]; then
  bootstrap "$cmd" "$1"
  exit 0
fi
case "$cmd" in
  create-smtp)
    [ $# -eq 1 ] || { usage; exit 1; }
    create_smtp "$1";;
  set-mapping)
    [ $# -eq 2 ] || { usage; exit 1; }
    set_mapping "$1" "$2";;
  add-rule)
    [ $# -eq 1 ] || { usage; exit 1; }
    add_rule "$1";;
  status)
    [ $# -eq 1 ] || { usage; exit 1; }
    status "$1";;
  '') usage; exit 1;;
  *) usage; exit 1;;
esac


