# SMS Not Working - AWS_REGION Issue

## Problem Found

The SNS service is **disabled** because `AWS_REGION` environment variable is not set.

When I tested the SNS service, it showed:
- `isInitialized: false`
- `isEnabled: false`
- Log: "SNS push notifications disabled in configuration"

## Root Cause

The emergency config checks for `AWS_REGION`:
```javascript
enableSNSPushNotifications: process.env.AWS_REGION ? true : false,
```

If `AWS_REGION` is not set, SNS is disabled and SMS won't work.

## Solution

### If Running on AWS (ECS/EC2)

The `AWS_REGION` should already be set in your deployment scripts. Check:

1. **Verify it's in your deployment:**
   - Check `devops/codedeploy/scripts/before_install.sh` (line 190)
   - It should have: `- AWS_REGION=$AWS_REGION`

2. **If missing, add it to your environment:**
   - Add `AWS_REGION=us-east-2` to your environment variables
   - Or ensure it's in AWS Secrets Manager

3. **Restart your application** after setting the variable

### If Running Locally

Set the environment variable:

```bash
export AWS_REGION=us-east-2
```

Or add it to your `.env` file:
```
AWS_REGION=us-east-2
```

### Quick Test

After setting `AWS_REGION`, test if SNS is enabled:

```bash
cd bianca-app-backend
node -e "const { snsService } = require('./src/services/sns.service'); console.log('SNS Enabled:', snsService.isInitialized);"
```

Should output: `SNS Enabled: true`

## Code Fix Applied

I've updated the config to also enable SNS in staging/production environments even if `AWS_REGION` isn't explicitly set (assuming it's an AWS environment). But it's still best to set `AWS_REGION` explicitly.

## Next Steps

1. **Set `AWS_REGION=us-east-2`** in your environment
2. **Restart your application**
3. **Test SMS sending** again
4. **Check application logs** for SNS initialization messages

