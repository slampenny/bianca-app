# Local Testing Guide for Blue-Green Deployment

## Overview

These scripts allow you to test deployment validation **locally** without running the entire pipeline. This saves hours of waiting and allows rapid iteration.

## Available Test Scripts

### 1. Test PostDeployValidation Logic
```bash
./packages/backend/devops/scripts/test-post-deploy-validation-local.sh [instance-id] [profile]
```

**What it does:**
- Finds green instance automatically (or use specific instance ID)
- Tests green instance directly by IP (same as pipeline)
- Simulates exact validation logic from `buildspec-post-deploy-validation.yml`
- Returns pass/fail in seconds

**Example:**
```bash
# Auto-detect green instance
./packages/backend/devops/scripts/test-post-deploy-validation-local.sh auto jordan

# Test specific instance
./packages/backend/devops/scripts/test-post-deploy-validation-local.sh i-xxxxx jordan
```

### 2. Test ValidateService Script
```bash
./packages/backend/devops/scripts/test-validate-service-local.sh [instance-id] [profile]
```

**What it does:**
- Uploads `validate_service.sh` to instance via SSM
- Runs validation script on the instance
- Tests container health, API endpoints, etc.
- Shows full validation output

**Example:**
```bash
./packages/backend/devops/scripts/test-validate-service-local.sh auto jordan
```

### 3. Test Buildspec Logic (Variable Persistence)
```bash
./packages/backend/devops/scripts/test-buildspec-post-deploy-validation.sh
```

**What it does:**
- Simulates pre_build and build phases
- Tests variable persistence between phases
- Helps debug why GREEN_INSTANCE_IP might be empty

### 4. Test CodeDeploy Readiness
```bash
./packages/backend/devops/scripts/test-codedeploy-readiness.sh [instance-id] [profile]
```

**What it does:**
- Checks if CodeDeploy agent is installed and running
- Verifies SSM connectivity
- Checks IAM permissions

### 5. Test CodeDeploy Deployment
```bash
./packages/backend/devops/scripts/test-codedeploy-deployment.sh [instance-id] [profile]
```

**What it does:**
- Creates deployment bundle
- Uploads to S3
- Creates CodeDeploy deployment
- Monitors deployment status

## Quick Test Workflow

```bash
# 1. Test if green instance is accessible (fastest test)
./packages/backend/devops/scripts/test-post-deploy-validation-local.sh auto jordan

# 2. If that passes, test the full validation script
./packages/backend/devops/scripts/test-validate-service-local.sh auto jordan

# 3. If both pass, your changes should work in the pipeline
```

## Common Issues

### Issue: "Cannot find green instance"
**Solution:** Check if green instance exists and is running:
```bash
aws ec2 describe-instances \
  --region us-east-2 \
  --profile jordan \
  --filters "Name=tag:Name,Values=bianca-staging-green" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].[InstanceId,State.Name,PublicIpAddress]' \
  --output table
```

### Issue: "Connection refused" or "000" HTTP code
**Solution:** Green instance containers might not be running. Check:
```bash
# Via SSM
aws ssm send-command \
  --instance-ids i-xxxxx \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["docker ps"]}' \
  --region us-east-2 \
  --profile jordan
```

### Issue: Variables not persisting between phases
**Solution:** Use `test-buildspec-post-deploy-validation.sh` to debug variable persistence. The buildspec re-discovers in build phase to handle this.

## Benefits

1. **Fast feedback** - Test in seconds instead of waiting 30+ minutes for pipeline
2. **Iterate quickly** - Fix issues and retest immediately
3. **Debug easily** - See exact error messages and HTTP codes
4. **Test before committing** - Validate changes work before pushing

## Integration with Pipeline

These scripts test the **exact same logic** that runs in the pipeline:
- `test-post-deploy-validation-local.sh` uses the same `test_url` function
- `test-validate-service-local.sh` runs the actual validation script
- Results should match pipeline behavior

If local tests pass, pipeline should pass (assuming no infrastructure issues).
