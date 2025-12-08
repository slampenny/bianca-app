# Fix: Terraform Using Wrong AWS Account

## Problem
Terraform is using account `243621520607` instead of `730335291008` even though profile "jordan" should be correct.

## Solution Options

### Option 1: Set AWS_PROFILE Environment Variable
```bash
export AWS_PROFILE=jordan
terraform init
terraform plan
```

### Option 2: Use Backend Config File
```bash
terraform init -backend-config=backend-config.hcl
terraform plan
```

### Option 3: Verify Profile Configuration
```bash
# Check what account the profile points to
aws sts get-caller-identity --profile jordan

# If it shows 243621520607, check your ~/.aws/config
cat ~/.aws/config | grep -A 5 "\[profile jordan\]"
```

### Option 4: Refresh SSO Session
```bash
aws sso login --profile jordan
export AWS_PROFILE=jordan
terraform init
terraform plan
```

## Why This Matters

Without the correct account, Terraform can't:
- Read existing state from S3
- See existing resources
- Show you only the pipeline changes

Once in the right account, you'll see only the pipeline configuration updates, not 212 new resources.
