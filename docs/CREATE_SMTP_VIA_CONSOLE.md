# Creating SMTP Credentials via AWS Console

## Yes, use the AWS Console!

The AWS SES Console has a built-in SMTP credential generator that creates credentials server-side, which should work more reliably than manual derivation.

## Steps via Console:

1. **Go to AWS SES Console**
   - Navigate to: https://console.aws.amazon.com/ses/
   - Make sure you're in region: `us-east-2`

2. **Go to SMTP Settings**
   - In the left sidebar, click "SMTP settings"
   - Or go directly to: https://console.aws.amazon.com/ses/home?region=us-east-2#/smtp

3. **Create SMTP Credentials**
   - Click "Create SMTP credentials"
   - Select the IAM user: `ses-smtp-jlaap` (or create a new one)
   - AWS will generate:
     - SMTP Server: `email-smtp.us-east-2.amazonaws.com`
     - Port: `587`
     - Username: (IAM access key ID)
     - Password: (AWS-generated SMTP password)

4. **Save Credentials**
   - Copy the credentials immediately (password is shown only once)
   - Store in Secrets Manager:
   ```bash
   aws secretsmanager update-secret \
     --secret-id ses/smtp/jlaap \
     --secret-string '{
       "server": "email-smtp.us-east-2.amazonaws.com",
       "port": 587,
       "username": "AKIA...",
       "password": "<console-generated-password>"
     }' \
     --profile jordan \
     --region us-east-2
   ```

## Why This Might Work Better:

- Console uses AWS's internal credential generation
- Ensures exact format matching AWS SMTP requirements
- Handles any edge cases in password derivation
- Password format is guaranteed to be correct

## Alternative: Verify Our Script's Algorithm

The console method will tell us if:
- Our password derivation is wrong (console password works)
- There's a deeper issue (console password also fails)

If console password works, we can then debug our script's algorithm.
If console password also fails, the issue is with IAM/user/permissions.

