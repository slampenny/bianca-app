# Corporate Email Forwarder Lambda Function

This Lambda function processes incoming emails stored in S3 and forwards them to mapped Gmail addresses.

## Architecture

1. **SES** receives email and stores it in S3
2. **S3** triggers Lambda via event notification
3. **Lambda** reads email from S3, parses it, and forwards to Gmail

## Environment Variables

- `EMAIL_MAPPINGS`: JSON string mapping corporate emails to Gmail addresses
  ```json
  {"jlapp@biancatechnologies.com": "negascout@gmail.com"}
  ```
- `FROM_DOMAIN`: Domain name (e.g., "biancatechnologies.com")
- `AWS_REGION`: AWS region (e.g., "us-east-2")
- `S3_BUCKET`: S3 bucket name storing emails

## Local Testing

```bash
# Install dependencies
pip install -r requirements.txt -t .

# Test locally (requires valid AWS credentials)
python test_handler.py
```

## Deployment

The function is deployed automatically via Terraform. The zip file is created from this directory.

## Function Details

- **Runtime**: Python 3.11
- **Timeout**: 60 seconds
- **Memory**: 256 MB
- **Handler**: `index.handler`

## Features

- ✅ Parses multipart emails (HTML, plain text, attachments)
- ✅ Preserves original sender in Reply-To header
- ✅ Handles attachments
- ✅ Skips spam/virus detected emails
- ✅ Comprehensive error handling and logging
- ✅ Supports multiple recipients per email

## Logging

All logs are sent to CloudWatch Logs under:
```
/aws/lambda/bianca-corp-email-forwarder
```

## Error Handling

- Emails that fail to forward are logged but don't stop processing
- Spam/virus detected emails are skipped
- Invalid email mappings result in warnings
- S3 access errors are logged with full details





