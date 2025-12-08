# Terraform SMS Attributes Configuration Update

## Summary

Added Terraform resources to automatically configure AWS SNS SMS attributes (`DefaultSMSType`) when Terraform is applied. This ensures that the SMS configuration is part of your infrastructure-as-code and will be applied when porting to new environments.

## Changes Made

### 1. Added `null_resource` for SMS Attributes

Added to all Terraform configurations:
- `devops/terraform-new/main.tf`
- `devops/terraform/main.tf`
- `devops/terraform-backup/main.tf`

The resource automatically sets `DefaultSMSType=Transactional` when Terraform is applied.

### 2. Updated Provider Requirements

Added `null` provider to `required_providers` in:
- `devops/terraform-new/versions.tf`
- `devops/terraform/versions.tf`
- `devops/terraform-backup/versions.tf`

### 3. Added Output

Added `sns_sms_default_type` output to show that SMS type is configured.

## How It Works

The `null_resource.sns_sms_attributes` resource:

1. **Runs on Apply**: Executes `aws sns set-sms-attributes` command during `terraform apply`
2. **Uses Variables**: Automatically uses `var.aws_region` and `var.aws_profile` from your Terraform configuration
3. **Handles Errors Gracefully**: If AWS CLI is not available, it logs a warning but doesn't fail
4. **Idempotent**: Can be run multiple times safely

## Usage

### Normal Apply

When you run `terraform apply`, the SMS attributes will be automatically configured:

```bash
cd devops/terraform-new  # or terraform, terraform-backup
terraform apply
```

The output will show:
```
null_resource.sns_sms_attributes: Creating...
null_resource.sns_sms_attributes: Provisioning with 'local-exec'...
null_resource.sns_sms_attributes: Creation complete after 1s
```

### Force Re-application

If you need to force the SMS attributes to be re-applied, uncomment the `force_update` trigger in the resource:

```hcl
triggers = {
  region   = var.aws_region
  sms_type = "Transactional"
  force_update = timestamp()  # Uncomment this line
}
```

### Manual Override

If AWS CLI is not available during Terraform apply, you can set it manually:

```bash
aws sns set-sms-attributes \
  --attributes DefaultSMSType=Transactional \
  --region us-east-2 \
  --profile jordan
```

## Verification

After applying Terraform, verify the setting:

```bash
aws sns get-sms-attributes \
  --profile jordan \
  --region us-east-2 \
  --query 'attributes.DefaultSMSType'
```

Should output: `"Transactional"`

## Important Notes

1. **Account-Level Setting**: SMS attributes are account-level, not resource-level. They persist even after `terraform destroy`.

2. **AWS CLI Required**: This resource requires AWS CLI to be installed and configured. If it's not available, Terraform will log a warning but continue.

3. **Permissions**: The AWS credentials used must have `sns:SetSMSAttributes` permission (usually included in AdministratorAccess).

4. **Idempotency**: The resource is idempotent - running `terraform apply` multiple times won't cause issues.

## Porting to New Environments

When porting this infrastructure to a new AWS account:

1. **Apply Terraform**: The SMS attributes will be automatically configured
2. **Verify**: Check that `DefaultSMSType` is set to `Transactional`
3. **Test**: Send a test SMS to verify end-to-end functionality

## Troubleshooting

### Error: "AWS CLI not found"
- **Solution**: Install AWS CLI or set SMS attributes manually (see Manual Override above)

### Error: "Access Denied"
- **Solution**: Ensure your AWS credentials have `sns:SetSMSAttributes` permission

### Setting Not Applied
- **Solution**: Check Terraform output for warnings, then set manually if needed

## Related Files

- `AWS_SMS_SETUP_VERIFICATION.md` - Complete SMS setup verification guide
- `bianca-app-backend/docs/PHONE_VERIFICATION_STRATEGY.md` - Phone verification implementation strategy

