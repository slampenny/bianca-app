# Check Migration Status in CloudWatch Logs

After deploying to production/staging, verify that migrations ran and the verification check passed.

## Quick Check Script

Run the helper script (requires AWS CLI with CloudWatch read permissions):

```bash
cd packages/backend/devops/scripts
./check-deployment-migrations.sh production
# or
./check-deployment-migrations.sh staging
```

This script:
- Searches CloudWatch logs for migration verification strings
- Shows recent migration-related log entries
- Checks both app container logs and CodeBuild logs

## What to Look For

After deployment, you should see these strings in the logs:

### ✅ Success Indicators:
- `✅ Migrations completed successfully`
- `🔍 Verifying migration status...`
- `✅ All critical migrations verified`

### ⚠️ Warning Indicators:
- `⚠️ Warning: Migration check reported issues`
- `❌ ERROR: Migrations failed`
- `CRITICAL: X critical migration(s) have not run`

## Manual CloudWatch Check

### Option 1: AWS Console

1. Go to CloudWatch → Log groups
2. Find `/bianca/production/app` (or `/bianca/staging/app`)
3. Open the most recent log stream
4. Search for: `Verifying migration status` or `All critical migrations verified`

### Option 2: AWS CLI

```bash
# Tail recent logs and filter for migration output
aws logs tail /bianca/production/app \
  --since 1h \
  --region us-east-2 \
  --filter-pattern "migrate" \
  --format short

# Or search for specific strings
aws logs filter-log-events \
  --log-group-name /bianca/production/app \
  --filter-pattern "All critical migrations verified" \
  --region us-east-2 \
  --max-items 10
```

### Option 3: CodeDeploy Logs

The migration verification runs during CodeDeploy's `application_start.sh` script. Check:

- CodeDeploy deployment logs in AWS Console
- EC2 instance logs: `/var/log/aws/codedeploy-agent/deployment-*/logs/scripts.log`

## Expected Timeline

1. **CodeBuild** runs tests (no migrations here)
2. **CodeDeploy** starts deployment
3. **application_start.sh** runs:
   - Step 1: Start MongoDB
   - **Step 2: Run migrations** (`yarn migrate:up`)
   - **Step 2b: Verify migrations** (`yarn migrate:check`) ← **NEW**
   - Step 3: Start containers

Look for the verification output right after "Migrations completed successfully".

## If Migrations Didn't Run

If you don't see migration output:

1. **Check if deployment is still running** - migrations run during CodeDeploy
2. **Check CodeDeploy status** in AWS Console
3. **SSH to the instance** and check:
   ```bash
   sudo tail -100 /var/log/aws/codedeploy-agent/deployment-*/logs/scripts.log
   ```
4. **Manually run migrations** if needed:
   ```bash
   cd /opt/bianca-production
   docker compose run --rm -e NODE_ENV=production -e MONGODB_URL=mongodb://mongodb:27017/bianca-service app yarn migrate:up
   docker compose run --rm -e NODE_ENV=production -e MONGODB_URL=mongodb://mongodb:27017/bianca-service app yarn migrate:check
   ```
