# Deployment Optimizations Summary

## Overview
This document summarizes all deployment optimizations implemented to reduce staging deployment time from ~20 minutes to ~7-10 minutes (50-65% faster).

## Optimizations Implemented

### 1. Parallel Docker Builds ✅
**Location**: `bianca-app-backend/scripts/deploy-staging.sh`

**Changes**:
- Build backend, frontend, and asterisk images in parallel using background jobs
- Push all images to ECR in parallel
- Single ECR login for all images (instead of 3 separate logins)

**Time Savings**: ~5-8 minutes

### 2. Terraform Drift Fixes ✅
**Locations**: 
- `bianca-app-backend/devops/terraform/staging-monitoring.tf`
- `bianca-app-backend/devops/terraform/staging.tf`
- `bianca-app-backend/devops/terraform/staging-schedule.tf`

**Changes**:
- CloudWatch Dashboard: Added `lifecycle { ignore_changes = [dashboard_body] }` to prevent updates when instance ID changes
- Lambda functions: Added `source_code_hash` to prevent unnecessary updates when code hasn't changed

**Time Savings**: ~2-3 minutes (prevents unnecessary Terraform applies)

### 3. Terraform Skip Logic ✅
**Location**: `bianca-app-backend/scripts/deploy-staging.sh`

**Changes**:
- Run `terraform plan` first to detect changes
- Skip `terraform apply` if no infrastructure changes detected
- Only apply when actual infrastructure changes are needed

**Time Savings**: ~2-3 minutes per deployment

### 4. Optimized Container Updates ✅
**Location**: `bianca-app-backend/scripts/deploy-staging.sh`

**Changes**:
- ECR token caching (12-hour cache to avoid repeated logins)
- Parallel image pulls with `docker-compose pull --parallel`
- Faster health checks (reduced MongoDB wait from 30s to 20s, 1s intervals)
- Optimized container status checks

**Time Savings**: ~1-2 minutes

### 5. GitHub Actions CI/CD ✅
**Location**: `.github/workflows/deploy-staging.yml`

**Features**:
- Auto-deploys when code is pushed to `staging` branch
- Parallel Docker builds and pushes
- Terraform skip logic
- Automatic instance startup if stopped
- SSM-based container updates
- Full error handling and status reporting

**Benefits**:
- No manual deployment needed
- Consistent deployment process
- Automatic on every push to staging branch

### 6. Instance Startup Optimizations ✅
**Location**: `bianca-app-backend/scripts/deploy-staging.sh`

**Changes**:
- ECR token caching on instance
- Faster health checks
- Optimized wait times

**Time Savings**: ~1 minute

## Expected Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Deployment Time | ~20 minutes | ~7-10 minutes | 50-65% faster |
| Docker Builds | Sequential (~12 min) | Parallel (~4 min) | 67% faster |
| Terraform Apply | Always runs (~3 min) | Skips when unchanged | 100% faster (when no changes) |
| Container Updates | Sequential pulls (~2 min) | Parallel pulls (~1 min) | 50% faster |

## Usage

### Manual Deployment
```bash
cd bianca-app-backend
./scripts/deploy-staging.sh
```

### Automatic Deployment (CI/CD)
1. Push code to `staging` branch
2. GitHub Actions automatically:
   - Builds images in parallel
   - Pushes to ECR
   - Deploys infrastructure (if changed)
   - Updates containers

### GitHub Setup (OIDC - No Secrets Needed!)

**No long-lived credentials required!** We use AWS OIDC (OpenID Connect) for secure authentication.

**One-time setup:**
1. Deploy the OIDC provider and IAM role:
   ```bash
   cd bianca-app-backend/devops/terraform
   terraform apply  # This creates the GitHub Actions IAM role
   ```

2. Get the role ARN:
   ```bash
   terraform output github_actions_role_arn
   ```

3. Add ONE GitHub Secret:
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Add secret: `AWS_ROLE_ARN` = (the ARN from step 2)

That's it! No access keys, no secrets to rotate. The role ARN is public and safe to store in GitHub Secrets.

## Branch Strategy

- **`staging` branch**: Auto-deploys to staging environment
- **`main` branch**: Production deployments (manual)

## Future Optimizations (Not Yet Implemented)

1. **Production Parallel Builds**: Apply same optimizations to `deploy-production.sh`
2. **Docker Layer Caching**: Use BuildKit cache mounts for faster builds
3. **Incremental Builds**: Only rebuild changed services
4. **Blue/Green Deployments**: Zero-downtime deployments
5. **ECS/Fargate Migration**: Eliminate EC2 instance management overhead

## Notes

- All optimizations are backward compatible
- Terraform drift issues are resolved (no more random 3-resource changes)
- CI/CD workflow includes full error handling and status reporting
- ECR token caching reduces authentication overhead

