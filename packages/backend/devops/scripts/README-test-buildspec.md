# Testing Buildspec Files Locally

## Overview

This directory contains scripts to test buildspec files locally before deploying to CodeBuild.

## Testing CreateGreenInstance Buildspec

### Prerequisites

1. AWS CLI installed and configured
2. AWS credentials with appropriate permissions
3. Environment variables set (or use defaults)

### Quick Test (Dry Run)

```bash
cd /home/jordanlapp/code/bianca-app
./packages/backend/devops/scripts/test-buildspec-create-green-instance.sh
```

### With Custom Environment Variables

```bash
export LAUNCH_TEMPLATE_NAME="bianca-staging-"
export SUBNET_ID="subnet-xxxxx"
export SECURITY_GROUP_ID="sg-xxxxx"
export INSTANCE_PROFILE_NAME="bianca-staging-instance-profile"
export KEY_NAME="your-key-name"
export AWS_DEFAULT_REGION="us-east-2"

./packages/backend/devops/scripts/test-buildspec-create-green-instance.sh
```

### Live Test (Actually Creates Instance)

⚠️ **WARNING**: This will create a real EC2 instance!

```bash
DRY_RUN=false ./packages/backend/devops/scripts/test-buildspec-create-green-instance.sh
```

## What the Test Script Does

1. **Validates YAML syntax** - Checks if the buildspec file is valid YAML
2. **Checks AWS credentials** - Verifies you can authenticate to AWS
3. **Tests pre_build phase** - Validates environment variables
4. **Tests build phase (dry run)** - Tests all AWS CLI commands without creating resources
5. **Validates resources** - Checks that launch templates, subnets, and security groups exist

## Getting Environment Variables from Terraform

You can get the actual values from your Terraform state:

```bash
cd packages/backend/devops/terraform
terraform output -json | jq -r '.staging_launch_template_name.value'
terraform output -json | jq -r '.staging_subnet_id.value'
terraform output -json | jq -r '.staging_security_group_id.value'
```

Or check the CodeBuild project environment variables in AWS Console.

## Troubleshooting

### YAML Validation Errors

If you get YAML parsing errors:
1. Check for special characters (emojis, unicode)
2. Ensure proper indentation (2 spaces, not tabs)
3. Validate with: `python3 -c "import yaml; yaml.safe_load(open('buildspec.yml'))"`

### AWS Permission Errors

Ensure your AWS credentials have:
- `ec2:DescribeLaunchTemplates`
- `ec2:DescribeLaunchTemplateVersions`
- `ec2:DescribeSubnets`
- `ec2:DescribeSecurityGroups`
- `ec2:RunInstances` (for live tests)
- `ec2:DescribeInstances`

### Launch Template Not Found

If the launch template name doesn't match:
- Check Terraform output for the actual name
- Launch templates with `name_prefix` have generated names
- The script will try to find by prefix pattern automatically
