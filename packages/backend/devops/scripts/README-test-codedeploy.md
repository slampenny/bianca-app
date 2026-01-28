# Testing CodeDeploy Locally

These scripts allow you to test CodeDeploy deployments **without running the entire pipeline**, saving time and reducing frustration.

## Scripts

### 1. `test-codedeploy-readiness.sh`
Tests if the CodeDeploy agent is installed and running on an instance.

**Usage:**
```bash
# Test a specific instance
./packages/backend/devops/scripts/test-codedeploy-readiness.sh i-0123456789abcdef0 jordan

# Auto-detect green instance
./packages/backend/devops/scripts/test-codedeploy-readiness.sh auto jordan
```

**What it checks:**
- Instance is running
- Instance tags are correct
- SSM agent is online
- CodeDeploy agent is installed and active
- IAM instance profile is attached
- Recent CodeDeploy agent logs

**Output:**
- ✅ If agent is ready, shows success and suggests next steps
- ❌ If not ready, shows what's wrong and how to fix it

### 2. `test-codedeploy-deployment.sh`
Creates and monitors a CodeDeploy deployment directly to an instance.

**Usage:**
```bash
./packages/backend/devops/scripts/test-codedeploy-deployment.sh i-0123456789abcdef0 jordan
```

**What it does:**
1. Verifies agent readiness
2. Creates a deployment bundle from current code
3. Uploads to S3
4. Creates a CodeDeploy deployment
5. Monitors deployment status in real-time
6. Shows detailed errors if deployment fails

**Benefits:**
- Test deployments in seconds, not minutes
- See errors immediately
- Iterate quickly on fixes
- No need to wait for full pipeline

## Workflow

### Before Running Pipeline
1. **Test agent readiness:**
   ```bash
   ./packages/backend/devops/scripts/test-codedeploy-readiness.sh auto jordan
   ```

2. **If agent is ready, test a deployment:**
   ```bash
   INSTANCE_ID=$(aws ec2 describe-instances \
     --filters "Name=tag:Name,Values=bianca-staging-green" "Name=instance-state-name,Values=running" \
     --profile jordan --query 'Reservations[0].Instances[0].InstanceId' --output text)
   ./packages/backend/devops/scripts/test-codedeploy-deployment.sh "$INSTANCE_ID" jordan
   ```

3. **Fix any issues found**

4. **Then run the full pipeline** (with confidence it will work)

### Debugging Failed Deployments

If a deployment fails in the pipeline:

1. **Get the deployment ID from CodePipeline console**

2. **Check instance status:**
   ```bash
   aws deploy get-deployment-instance \
     --deployment-id d-XXXXX \
     --instance-id i-XXXXX \
     --profile jordan \
     --query 'instanceSummary.lifecycleEvents[?status==`Failed`]' \
     --output json | python3 -m json.tool
   ```

3. **Check agent logs on instance:**
   ```bash
   aws ssm send-command \
     --instance-ids i-XXXXX \
     --document-name "AWS-RunShellScript" \
     --parameters 'commands=["sudo tail -50 /var/log/aws/codedeploy-agent/codedeploy-agent.log"]' \
     --profile jordan
   ```

4. **Check deployment hooks logs:**
   ```bash
   aws ssm send-command \
     --instance-ids i-XXXXX \
     --document-name "AWS-RunShellScript" \
     --parameters 'commands=["sudo tail -50 /var/log/aws/codedeploy-agent/deployment-*/logs/scripts.log"]' \
     --profile jordan
   ```

## Common Issues

### Agent Not Running
**Symptom:** `test-codedeploy-readiness.sh` shows agent is inactive

**Fix:**
```bash
# Use the fix script via SSM
aws ssm send-command \
  --instance-ids i-XXXXX \
  --document-name "AWS-RunShellScript" \
  --parameters file://packages/backend/devops/scripts/fix-codedeploy-agent.sh \
  --profile jordan
```

### Deployment Fails at ApplicationStop
**Symptom:** First lifecycle event fails

**Cause:** Usually means agent can't receive commands (IAM permissions, network, or agent not fully registered)

**Fix:** Wait longer after instance creation, or check IAM permissions

### Deployment Fails at BeforeInstall/AfterInstall
**Symptom:** Hook script fails

**Cause:** Script syntax error, missing dependencies, or permissions issue

**Fix:** Check the hook script logs on the instance

## Tips

- **Always test readiness first** - saves time if agent isn't ready
- **Use `auto` for instance ID** - automatically finds the green instance
- **Monitor in real-time** - the test script shows progress
- **Check logs immediately** - errors are shown right away
- **Iterate quickly** - fix, test, repeat without pipeline delays

## Integration with Pipeline

These scripts complement the pipeline:
- **Local testing:** Fast iteration, immediate feedback
- **Pipeline:** Full integration test, production-like environment

Use local testing for development, pipeline for final validation.
