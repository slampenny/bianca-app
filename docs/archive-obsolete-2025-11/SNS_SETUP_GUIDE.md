# SNS Emergency Notifications Setup Guide

## Overview

This guide will help you set up AWS SNS (Simple Notification Service) for emergency notifications in your Bianca app. SNS will send SMS messages to caregivers when emergency situations are detected.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform access to your AWS account
- Emergency detection system already installed

## Step 1: Deploy SNS Infrastructure with Terraform

### 1.1 Apply Terraform Changes

```bash
cd devops/terraform
terraform plan
terraform apply
```

This will create:
- SNS Topic: `bianca-emergency-alerts`
- IAM policies for ECS task to publish to SNS
- SNS Topic policy allowing ECS task role access

### 1.2 Get the SNS Topic ARN

After applying Terraform, get the topic ARN:

```bash
terraform output emergency_sns_topic_arn
```

This will output something like:
```
"arn:aws:sns:us-east-2:123456789012:bianca-emergency-alerts"
```

## Step 2: Configure Environment Variables

### 2.1 Set Environment Variable

Add the SNS topic ARN to your environment variables:

```bash
export EMERGENCY_SNS_TOPIC_ARN="arn:aws:sns:us-east-2:123456789012:bianca-emergency-alerts"
```

### 2.2 Enable SNS in Emergency Config

Update your emergency configuration to enable SNS notifications:

```json
{
  "enableSNSPushNotifications": true,
  "debounceMinutes": 5,
  "maxAlertsPerHour": 10
}
```

Or set via environment variable:

```bash
export EMERGENCY_CONFIG='{"enableSNSPushNotifications": true, "debounceMinutes": 5}'
```

## Step 3: Configure SNS Subscriptions

### 3.1 Add Phone Number Subscriptions

You need to subscribe phone numbers to the SNS topic. You can do this via AWS Console or CLI:

#### Via AWS Console:
1. Go to SNS in AWS Console
2. Find the `bianca-emergency-alerts` topic
3. Click "Create subscription"
4. Choose "SMS" as protocol
5. Enter phone number (e.g., `+1234567890`)
6. Click "Create subscription"

#### Via AWS CLI:
```bash
aws sns subscribe \
  --topic-arn "arn:aws:sns:us-east-2:123456789012:bianca-emergency-alerts" \
  --protocol sms \
  --notification-endpoint "+1234567890"
```

### 3.2 Confirm Subscriptions

For SMS subscriptions, you may need to confirm them:

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn "arn:aws:sns:us-east-2:123456789012:bianca-emergency-alerts"
```

## Step 4: Test the Integration

### 4.1 Run the Test Script

```bash
node test-sns-integration.js
```

This will test:
- SNS service initialization
- Emergency detection
- SNS notification sending

### 4.2 Test with Real Emergency

In your app, try saying something like:
- "I'm having a heart attack"
- "I can't breathe"
- "I fell down and can't get up"

You should receive SMS notifications on subscribed phone numbers.

## Step 5: Production Configuration

### 5.1 ECS Task Definition

Make sure your ECS task definition includes the environment variable:

```json
{
  "environment": [
    {
      "name": "EMERGENCY_SNS_TOPIC_ARN",
      "value": "arn:aws:sns:us-east-2:123456789012:bianca-emergency-alerts"
    }
  ]
}
```

### 5.2 Secrets Manager (Recommended)

For production, store the SNS topic ARN in AWS Secrets Manager:

```bash
aws secretsmanager update-secret \
  --secret-id "MySecretsManagerSecret" \
  --secret-string '{
    "EMERGENCY_SNS_TOPIC_ARN": "arn:aws:sns:us-east-2:123456789012:bianca-emergency-alerts",
    "other_secrets": "values"
  }'
```

## Step 6: Monitoring and Troubleshooting

### 6.1 CloudWatch Logs

Monitor emergency detection logs:

```bash
aws logs filter-log-events \
  --log-group-name "/ecs/bianca-app" \
  --filter-pattern "Emergency Detection"
```

### 6.2 SNS Metrics

Monitor SNS delivery in CloudWatch:
- Go to CloudWatch → Metrics → SNS
- Look for delivery success/failure rates

### 6.3 Common Issues

**Issue**: "SNS topic ARN not configured"
**Solution**: Set `EMERGENCY_SNS_TOPIC_ARN` environment variable

**Issue**: "Access denied" when publishing to SNS
**Solution**: Verify IAM permissions are applied to ECS task role

**Issue**: SMS not received
**Solution**: Check phone number format (+1234567890), confirm subscription, verify AWS region

## Step 7: Cost Management

### 7.1 SMS Pricing

AWS SNS SMS pricing varies by region and carrier:
- US: ~$0.0075 per SMS
- International: Varies by country

### 7.2 Cost Optimization

- Use deduplication to prevent spam
- Set reasonable `maxAlertsPerHour` limits
- Monitor usage in AWS Cost Explorer

## Step 8: Security Considerations

### 8.1 Phone Number Privacy

- Only subscribe verified caregiver phone numbers
- Use IAM policies to restrict SNS access
- Monitor SNS usage for unauthorized access

### 8.2 Message Content

Emergency messages include:
- Patient name
- Emergency type
- Severity level
- Timestamp

Ensure this information is appropriate for SMS delivery.

## Support

If you encounter issues:

1. Check CloudWatch logs for error messages
2. Verify AWS credentials and permissions
3. Test SNS connectivity with AWS CLI
4. Review Terraform state for resource creation

## Cleanup

To remove SNS resources:

```bash
cd devops/terraform
terraform destroy -target=aws_sns_topic.emergency_alerts
terraform destroy -target=aws_sns_topic_policy.emergency_alerts_policy
terraform destroy -target=aws_iam_policy.ecs_task_sns_policy
```
