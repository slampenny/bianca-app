# GitHub Actions OIDC Setup Guide

## Overview

This setup uses **AWS OIDC (OpenID Connect)** instead of storing AWS credentials in GitHub Secrets. This is more secure because:

- ✅ **No long-lived credentials** - No access keys to rotate
- ✅ **No secrets duplication** - Everything stays in AWS Secrets Manager
- ✅ **Automatic expiration** - Tokens expire after each workflow run
- ✅ **Repository-scoped** - Only your specific GitHub repos can assume the role

## One-Time Setup

### Step 1: Deploy the OIDC Provider and IAM Role

```bash
cd bianca-app-backend/devops/terraform
terraform apply
```

This creates:
- An OIDC provider for GitHub Actions
- An IAM role that GitHub Actions can assume
- Permissions for ECR, EC2, SSM, S3, and DynamoDB (for Terraform state)

### Step 2: Get the Role ARN

```bash
terraform output github_actions_role_arn
```

You'll get something like:
```
arn:aws:iam::730335291008:role/github-actions-deploy-role
```

### Step 3: Add ONE GitHub Secret

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `AWS_ROLE_ARN`
5. Value: (paste the ARN from Step 2)

**That's it!** No access keys, no secrets to manage.

## How It Works

1. GitHub Actions workflow runs
2. GitHub generates a temporary OIDC token
3. AWS validates the token (checks it's from your repo)
4. AWS grants temporary credentials (valid for 1 hour)
5. Workflow uses these credentials to deploy

## Security

- The role ARN is **public** - it's safe to store in GitHub Secrets
- Only workflows from your specified repositories can assume the role
- Credentials automatically expire after each run
- No secrets to rotate or manage

## Troubleshooting

### "Access Denied" errors

1. Check the repository name in `github-actions-oidc.tf` matches your actual repo
2. Verify the role ARN in GitHub Secrets is correct
3. Check IAM role permissions in AWS Console

### "No OpenIDConnect provider found"

Run `terraform apply` to create the OIDC provider.

## Updating Repository Names

If you rename your GitHub repos, update the condition in `github-actions-oidc.tf`:

```hcl
"token.actions.githubusercontent.com:sub" = [
  "repo:YOUR_ORG/YOUR_REPO:*"
]
```

Then run `terraform apply` to update the role.

