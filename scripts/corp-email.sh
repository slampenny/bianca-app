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
  python3 - "$secret_key_json" <<'PY'
import json,sys,hmac,hashlib,base64
region='us-east-2'; service='ses'; terminal='aws4_request'; message='SendRawEmail'; version=b'\x04'
data=json.load(open(sys.argv[1]))
sk=data['SecretAccessKey']
k_date=hmac.new(('AWS4'+sk).encode(),region.encode(),hashlib.sha256).digest()
k_service=hmac.new(k_date,service.encode(),hashlib.sha256).digest()
k_terminal=hmac.new(k_service,terminal.encode(),hashlib.sha256).digest()
sig=hmac.new(k_terminal,message.encode(),hashlib.sha256).digest()
print(json.dumps({'SMTPUsername':data['AccessKeyId'],'SMTPPassword':base64.b64encode(version+sig).decode()}))
PY
}

create_smtp() {
  local email="$1"; local user="ses-smtp-$(localpart "$email")"
  echo "Creating/ensuring IAM user ${user}..."
  aws iam create-user --user-name "$user" >/dev/null 2>&1 || true
  cat > /tmp/ses-send-policy.json <<'POL'
{ "Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail"],"Resource":"*"}]}
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
  # Skip if rule already exists for this recipient
  if aws ses describe-receipt-rule-set --rule-set-name "$RULE_SET" --output json | jq -e --arg email "$email" '.Rules[] | select(.Recipients[]? == $email)' >/dev/null 2>&1; then
    echo "Rule already exists for $email"
    echo "Rule ensured: corp-${lp}"
    return 0
  fi
  # Create S3 bucket policy to allow SES puts
  cat > /tmp/bucket-policy.json <<JSON
{ "Version":"2012-10-17", "Statement":[{"Sid":"AllowSESPuts","Effect":"Allow","Principal":{"Service":"ses.amazonaws.com"},"Action":"s3:PutObject","Resource":"arn:aws:s3:::${S3_BUCKET}/*","Condition":{"StringEquals":{"aws:Referer":"${account_id}"}}}]}
JSON
  aws s3api put-bucket-policy --bucket "$S3_BUCKET" --policy file:///tmp/bucket-policy.json >/dev/null || true
  # Prepare rule payload
  rule_payload=$(jq -c --arg email "$email" --arg bucket "$S3_BUCKET" --arg pref "corp/${lp}/" --arg fn "arn:aws:lambda:${AWS_REGION}:${account_id}:function:${LAMBDA_NAME}" '{Name: ("corp-"+($email|split("@")[0])), Enabled:true, TlsPolicy:"Optional", Recipients:[$email], Actions:[{S3Action:{BucketName:$bucket, ObjectKeyPrefix:$pref}},{LambdaAction:{FunctionArn:$fn,InvocationType:"Event"}}] }')
  # Create with timeout to avoid hanging
  if ! timeout 8 aws ses create-receipt-rule --rule-set-name "$RULE_SET" --rule "$rule_payload" >/dev/null 2>&1; then
    echo "create-receipt-rule timed out; verifying..."
  fi
  # Verify
  if aws ses describe-receipt-rule-set --rule-set-name "$RULE_SET" --output json | jq -e --arg email "$email" '.Rules[] | select(.Recipients[]? == $email)' >/dev/null 2>&1; then
    echo "Rule ensured: corp-${lp}"
  else
    echo "Warning: could not confirm rule creation. Create it manually with:"
    echo "aws --profile $AWS_PROFILE --region $AWS_REGION ses create-receipt-rule --rule-set-name $RULE_SET --rule '$rule_payload'"
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
    aws ses send-email \
      --from "noreply@${CORP_DOMAIN}" \
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


