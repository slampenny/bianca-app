# Deploy CloudWatch Logs and SES Bounce Notifications

## Status
✅ **Code committed and pushed to staging branch**

## What Was Added

### 1. CloudWatch Log Groups (HIPAA 7-year retention)
- `/bianca/staging/app` - Application logs
- `/bianca/staging/mongodb` - MongoDB logs
- `/bianca/staging/asterisk` - Asterisk logs
- `/bianca/staging/nginx` - Nginx logs
- `/bianca/staging/frontend` - Frontend logs
- Retention: **2557 days** (closest valid value to 7 years for HIPAA compliance)

### 2. Docker Logging Configuration
- Updated `devops/codedeploy/scripts/before_install.sh` to use `awslogs` driver
- All containers now send logs directly to CloudWatch (bypassing local disk)

### 3. SES Bounce/Complaint Notifications
- SNS Topic: `bianca-staging-ses-bounce-complaint`
- Email subscription: `jlapp@biancatechnologies.com`
- Configured for `myphonefriend.com` domain
- Includes original headers for debugging

## Deployment Steps

### Option 1: Apply Terraform (Recommended)
```bash
cd devops/terraform
aws sso login --profile jordan  # Re-authenticate if needed
terraform plan
terraform apply
```

### Option 2: Create Resources via AWS CLI
```bash
# Re-authenticate AWS SSO
aws sso login --profile jordan

# Create CloudWatch Log Groups
for log_group in app mongodb asterisk nginx frontend; do
  aws logs create-log-group --profile jordan --log-group-name "/bianca/staging/$log_group"
  aws logs put-retention-policy --profile jordan --log-group-name "/bianca/staging/$log_group" --retention-in-days 2557
done

# Create SNS Topic
TOPIC_ARN=$(aws sns create-topic --profile jordan --name "bianca-staging-ses-bounce-complaint" --output text --query 'TopicArn')
aws sns subscribe --profile jordan --topic-arn "$TOPIC_ARN" --protocol email --notification-endpoint "jlapp@biancatechnologies.com"

# Configure SES Notifications
aws ses set-identity-notification-topic --profile jordan --identity "myphonefriend.com" --notification-type Bounce --sns-topic "$TOPIC_ARN"
aws ses set-identity-notification-topic --profile jordan --identity "myphonefriend.com" --notification-type Complaint --sns-topic "$TOPIC_ARN"
aws ses set-identity-headers-in-notifications-enabled --profile jordan --identity "myphonefriend.com" --notification-type Bounce --enabled
aws ses set-identity-headers-in-notifications-enabled --profile jordan --identity "myphonefriend.com" --notification-type Complaint --enabled
```

## After Deployment

1. **Confirm SNS Subscription**: Check `jlapp@biancatechnologies.com` for AWS SNS confirmation email and click the link
2. **Trigger CodeDeploy**: The next CodeDeploy will use CloudWatch Logs automatically
3. **Test Email**: Send a test email and check CloudWatch Logs for confirmation
4. **Monitor Bounces**: You'll receive SNS notifications when emails bounce or are complained about

## Verification

```bash
# Check CloudWatch Log Groups
aws logs describe-log-groups --profile jordan --log-group-name-prefix "/bianca/staging" --query "logGroups[*].[logGroupName,retentionInDays]"

# Check SNS Topic
aws sns list-topics --profile jordan --query "Topics[?contains(TopicArn, 'ses-bounce-complaint')]"

# Check SES Notification Configuration
aws ses get-identity-notification-attributes --profile jordan --identities myphonefriend.com
```

