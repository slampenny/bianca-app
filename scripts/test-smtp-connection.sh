#!/usr/bin/env bash
# Test SMTP connection to SES
# Usage: ./test-smtp-connection.sh <email@biancatechnologies.com>

set -euo pipefail

EMAIL="${1:-jlapp@biancatechnologies.com}"
AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-us-east-2}"

localpart() {
  local email="$1"
  echo "$email" | awk -F'@' '{print tolower($1)}'
}

LP=$(localpart "$EMAIL")
SECRET="ses/smtp/${LP}"

echo "Fetching SMTP credentials from Secrets Manager: $SECRET"
SMTP_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRET" --profile "$AWS_PROFILE" --query SecretString --output text 2>&1)

if [ $? -ne 0 ]; then
  echo "Error: Could not fetch SMTP credentials. Run: ./corp-email.sh create-smtp $EMAIL"
  exit 1
fi

SERVER=$(echo "$SMTP_JSON" | jq -r .server)
PORT=$(echo "$SMTP_JSON" | jq -r .port)
USERNAME=$(echo "$SMTP_JSON" | jq -r .username)
PASSWORD=$(echo "$SMTP_JSON" | jq -r .password)

echo ""
echo "Testing SMTP connection..."
echo "Server: $SERVER"
echo "Port:   $PORT"
echo "User:   $USERNAME"
echo ""

# Test with Python
python3 <<EOF
import smtplib
from email.mime.text import MIMEText
import sys

server = "$SERVER"
port = int("$PORT")
username = "$USERNAME"
password = "$PASSWORD"
from_email = "$EMAIL"
to_email = "${EMAIL}@gmail.com".replace("@biancatechnologies.com", "")

try:
    print("Connecting to SMTP server...")
    smtp = smtplib.SMTP(server, port)
    smtp.set_debuglevel(1)
    
    print("Starting TLS...")
    smtp.starttls()
    
    print("Authenticating...")
    smtp.login(username, password)
    print("✓ Authentication successful!")
    
    print("Sending test email...")
    msg = MIMEText("This is a test email from $EMAIL")
    msg['Subject'] = "Test Email from $EMAIL"
    msg['From'] = from_email
    msg['To'] = "$EMAIL"
    
    smtp.sendmail(from_email, ["$EMAIL"], msg.as_string())
    print("✓ Test email sent successfully!")
    
    smtp.quit()
    print("\n✓ All tests passed!")
    sys.exit(0)
except Exception as e:
    print(f"\n✗ Error: {e}")
    sys.exit(1)
EOF


