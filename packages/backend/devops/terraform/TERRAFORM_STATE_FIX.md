# Fixing Terraform State Access Issue

## Problem
Terraform is trying to access S3 bucket `bianca-terraform-state` but getting Access Denied (403).

## Solutions

### Option 1: Use Local State (Temporary - for testing)

If you just want to test the Terraform changes without dealing with S3:

1. **Comment out the backend configuration:**
   ```bash
   # Edit backend.tf
   # Comment out the backend block:
   # terraform {
   #   backend "s3" {
   #     bucket  = "bianca-terraform-state"
   #     key     = "backend/terraform.tfstate"
   #     region  = "us-east-2"
   #     encrypt = true
   #   }
   # }
   ```

2. **Initialize with local state:**
   ```bash
   terraform init -migrate-state
   ```

3. **Run terraform plan:**
   ```bash
   terraform plan
   ```

**Note:** This will use local state. Make sure to uncomment the backend before committing or sharing.

### Option 2: Fix S3 Permissions (Recommended for production)

The bucket `bianca-terraform-state` needs to exist and you need access.

1. **Check if bucket exists:**
   ```bash
   aws s3 ls s3://bianca-terraform-state --region us-east-2
   ```

2. **If bucket doesn't exist, create it:**
   ```bash
   aws s3 mb s3://bianca-terraform-state --region us-east-2
   aws s3api put-bucket-versioning \
     --bucket bianca-terraform-state \
     --versioning-configuration Status=Enabled \
     --region us-east-2
   ```

3. **Check your AWS credentials:**
   ```bash
   aws sts get-caller-identity
   ```

4. **If using a profile:**
   ```bash
   export AWS_PROFILE=jordan
   # or
   terraform init -backend-config="profile=jordan"
   ```

### Option 3: Use Different Backend Configuration

If you want to use a different bucket or region:

1. **Update backend.tf:**
   ```terraform
   terraform {
     backend "s3" {
       bucket  = "your-terraform-state-bucket"
       key     = "backend/terraform.tfstate"
       region  = "us-east-2"
       encrypt = true
       profile = "jordan"  # Add if using AWS profile
     }
   }
   ```

2. **Reinitialize:**
   ```bash
   terraform init -migrate-state
   ```

## Quick Fix for Testing

If you just want to test the pipeline changes:

```bash
# Temporarily use local state
cd packages/backend/devops/terraform
cp backend.tf backend.tf.backup
echo '# terraform {
#   backend "s3" {
#     bucket  = "bianca-terraform-state"
#     key     = "backend/terraform.tfstate"
#     region  = "us-east-2"
#     encrypt = true
#   }
# }' > backend.tf

terraform init
terraform plan

# Restore when done
mv backend.tf.backup backend.tf
```

## For Production

Make sure:
1. The S3 bucket exists
2. Your AWS credentials have S3 access
3. The bucket has versioning enabled (for state safety)
4. You're using the correct AWS profile/region
