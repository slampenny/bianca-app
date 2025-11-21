# Recreating Production Instance to Apply Fixes

This guide will help you recreate the production instance to apply both fixes:
1. TwiML mediaStream bug fix (in Docker image)
2. Asterisk ARI password fix (in userdata script)

## Steps

### Step 1: Build and Push Docker Images
Run the deploy script to build new images with the TwiML fix:
```bash
cd bianca-app-backend
./scripts/deploy-production.sh
```

This will:
- Build new backend Docker image with TwiML fix
- Build new frontend Docker image
- Push both to ECR
- Run Terraform (but won't recreate instance yet)

### Step 2: Taint the Production Instance
This marks the instance for recreation:
```bash
cd devops/terraform
AWS_PROFILE=jordan AWS_DEFAULT_REGION=us-east-2 terraform init
AWS_PROFILE=jordan AWS_DEFAULT_REGION=us-east-2 terraform taint aws_instance.production
```

### Step 3: Apply Terraform to Recreate Instance
This will recreate the instance with the updated userdata script:
```bash
AWS_PROFILE=jordan AWS_DEFAULT_REGION=us-east-2 terraform apply --auto-approve
```

**Note:** This will:
- Terminate the existing production instance
- Create a new instance with the updated userdata script
- The new userdata script will fetch Asterisk passwords from Secrets Manager
- All containers will be recreated with the new configuration

### Step 4: Verify the Fixes
After the instance is recreated, verify:

1. **TwiML Fix**: Check that calls work without `[object Object]` in the TwiML
2. **Asterisk Password Fix**: Check Asterisk logs:
   ```bash
   ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<PRODUCTION_IP>
   docker logs production_asterisk | grep -i "password"
   ```
   Should NOT see "missing password" errors.

## What Gets Fixed

### Fix 1: TwiML mediaStream Bug ✅
- **File**: `bianca-app-backend/src/services/twilioCall.service.js`
- **Change**: Removed invalid `mediaStream` object from TwiML Dial verb
- **Result**: TwiML will no longer contain `[object Object]`

### Fix 2: Asterisk ARI Password ✅
- **File**: `bianca-app-backend/devops/terraform/production-userdata.sh`
- **Changes**:
  - Added jq installation
  - Added code to fetch ARI_PASSWORD and BIANCA_PASSWORD from Secrets Manager
  - Passes passwords to Asterisk container in docker-compose.yml
- **Result**: Asterisk will authenticate properly with ARI

## Important Notes

- The instance will be down for a few minutes during recreation
- MongoDB data persists on EBS volume (attached automatically
- All containers will be recreated with fresh configuration
- The new instance will have the updated userdata script baked in








