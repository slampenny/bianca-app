# CodeBuild Staging Role - Permissions Audit

## Overview
This document audits the IAM permissions for `bianca-codebuild-staging-role` to ensure all required permissions are present for blue-green deployments.

## Buildspecs Analyzed
1. `buildspec-create-green-instance.yml` - Creates new EC2 instances for green environment
2. `buildspec-swap-and-terminate.yml` - Swaps traffic and terminates old instances

## Required Permissions by Buildspec

### buildspec-create-green-instance.yml

| AWS API Call | Required Permission | Status | Notes |
|-------------|---------------------|--------|-------|
| `aws ec2 describe-launch-templates` | `ec2:DescribeLaunchTemplates` | ✅ Present | Line 156 |
| `aws ec2 describe-launch-template-versions` | `ec2:DescribeLaunchTemplateVersions` | ✅ Present | Line 157 |
| `aws ec2 describe-instances` | `ec2:DescribeInstances` | ✅ Present | Line 142 (SSM block), also added to EC2 block |
| `aws ec2 run-instances` | `ec2:RunInstances` | ✅ Present | Line 150 |
| `aws ec2 run-instances` (with IAM role) | `iam:PassRole` | ✅ Present | Line 199-208 (just added) |
| `aws ec2 wait instance-running` | `ec2:DescribeInstances` | ✅ Present | Uses DescribeInstances internally |
| `aws ec2 describe-instance-status` | `ec2:DescribeInstanceStatus` | ✅ Present | Line 152 |

### buildspec-swap-and-terminate.yml

| AWS API Call | Required Permission | Status | Notes |
|-------------|---------------------|--------|-------|
| `aws ec2 describe-instances` | `ec2:DescribeInstances` | ✅ Present | Line 142 (SSM block), also added to EC2 block |
| `aws elbv2 describe-target-health` | `elasticloadbalancing:DescribeTargetHealth` | ✅ Present | Line 176 |
| `aws elbv2 register-targets` | `elasticloadbalancing:RegisterTargets` | ✅ Present | Line 174 |
| `aws elbv2 deregister-targets` | `elasticloadbalancing:DeregisterTargets` | ✅ Present | Line 175 |
| `aws ec2 terminate-instances` | `ec2:TerminateInstances` | ✅ Present | Line 151 |
| `aws ec2 wait instance-terminated` | `ec2:DescribeInstances` | ✅ Present | Uses DescribeInstances internally |
| `aws ec2 create-tags` | `ec2:CreateTags` | ✅ Present | Line 154 |
| `aws ec2 delete-tags` | `ec2:DeleteTags` | ✅ **FIXED** | **Was missing, now added** |

## Issues Found and Fixed

### Issue 1: Missing `iam:PassRole` permission
- **Error**: `User is not authorized to perform: iam:PassRole on resource: arn:aws:iam::730335291008:role/bianca-staging-instance-role`
- **Fix**: Added `iam:PassRole` permission with condition to pass role to `ec2.amazonaws.com`
- **Status**: ✅ Fixed in commit bd532867

### Issue 2: Missing `ec2:DeleteTags` permission
- **Location**: `buildspec-swap-and-terminate.yml` line 192
- **Issue**: Buildspec uses `aws ec2 delete-tags` but permission was missing
- **Fix**: Added `ec2:DeleteTags` to EC2 permissions block
- **Status**: ✅ Fixed in current commit

### Issue 3: `ec2:DescribeInstances` clarity
- **Issue**: `ec2:DescribeInstances` was only in SSM block, not explicitly in EC2 block
- **Fix**: Added `ec2:DescribeInstances` to EC2 permissions block for clarity
- **Status**: ✅ Fixed in current commit

## Current Permission Summary

### EC2 Permissions
- ✅ `ec2:RunInstances` - Create instances
- ✅ `ec2:TerminateInstances` - Terminate instances
- ✅ `ec2:DescribeInstances` - Query instance state
- ✅ `ec2:DescribeInstanceStatus` - Check instance health
- ✅ `ec2:DescribeInstanceAttribute` - Get instance attributes
- ✅ `ec2:CreateTags` - Tag instances
- ✅ `ec2:DeleteTags` - Remove tags (NEW)
- ✅ `ec2:DescribeTags` - Query tags
- ✅ `ec2:DescribeLaunchTemplates` - Query launch templates
- ✅ `ec2:DescribeLaunchTemplateVersions` - Query template versions
- ✅ EIP, Volume, and other EC2 permissions

### ELB/ALB Permissions
- ✅ `elasticloadbalancing:RegisterTargets` - Add instances to target groups
- ✅ `elasticloadbalancing:DeregisterTargets` - Remove instances from target groups
- ✅ `elasticloadbalancing:DescribeTargetHealth` - Check target health
- ✅ `elasticloadbalancing:DescribeTargetGroups` - Query target groups
- ✅ `elasticloadbalancing:DescribeLoadBalancers` - Query load balancers

### IAM Permissions
- ✅ `iam:PassRole` - Pass instance role to EC2 (with condition: `ec2.amazonaws.com`)

### Other Permissions
- ✅ ECR, S3, SSM, Secrets Manager, CodePipeline (for other pipeline stages)

## Verification

After applying Terraform changes, the following should work:
1. ✅ Create green instance with IAM role attached
2. ✅ Query instance state and health
3. ✅ Register/deregister instances with ALB target groups
4. ✅ Terminate old instances
5. ✅ Create and delete instance tags

## Testing Recommendations

1. Run `terraform plan` to verify changes
2. Apply Terraform changes
3. Trigger pipeline and monitor for permission errors
4. Verify green instance creation succeeds
5. Verify swap-and-terminate stage succeeds
