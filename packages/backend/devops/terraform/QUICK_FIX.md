# Quick Fix: Just Check What Would Change

You're right - you're not recreating anything. You just need to see what Terraform would change.

## The Problem
Terraform can't read the existing state from S3, so it can't show you the plan.

## Quick Solution

Run these commands to check if the bucket exists and fix access:

```bash
cd packages/backend/devops/terraform

# 1. Check if you can access AWS
aws sts get-caller-identity --profile jordan

# 2. Check if bucket exists
aws s3 ls s3://bianca-terraform-state --region us-east-2 --profile jordan

# 3. If bucket doesn't exist, create it (one-time setup)
aws s3 mb s3://bianca-terraform-state --region us-east-2 --profile jordan

# 4. Update backend.tf to use your profile (I already did this)
# The backend.tf now has: profile = "jordan"

# 5. Reinitialize Terraform
terraform init

# 6. Now you can see the plan (should show minimal changes)
terraform plan
```

## What You'll See

The plan should show:
- ✅ CodePipeline source repository change (from `bianca-app-backend` to `bianca-app`)
- ✅ CodeBuild buildspec path change (from `devops/buildspec-*.yml` to `buildspec-*.yml`)
- ✅ Removal of FrontendSource action (no longer needed)

**No infrastructure will be recreated** - just configuration updates.
