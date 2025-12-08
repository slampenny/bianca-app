# Terraform Pipeline Updates for Monorepo

## Summary

Updated Terraform configuration to work with the monorepo structure (`slampenny/bianca-app`).

## Changes Made

### 1. Updated Default Repository Variable
**File:** `packages/backend/devops/terraform/main.tf`

Changed the default `github_repo` variable from `"bianca-app-backend"` to `"bianca-app"`:

```terraform
variable "github_repo" {
  description = "GitHub repository name."
  type        = string
  default     = "bianca-app"  # Updated from "bianca-app-backend"
}
```

### 2. Updated Staging Pipeline
**File:** `packages/backend/devops/terraform/codepipeline-staging.tf`

- **Removed separate FrontendSource action** - No longer needed since frontend is in the monorepo
- **Updated buildspec path** from `devops/buildspec-staging.yml` to `buildspec-staging.yml` (root)
- **Updated input artifacts** to only use `SourceOutput` (removed `FrontendSourceOutput`)

**Before:**
- Two source actions: Backend (`slampenny/bianca-app-backend`) and Frontend (`slampenny/bianca-app-frontend`)
- Buildspec: `devops/buildspec-staging.yml`
- Input artifacts: `["SourceOutput", "FrontendSourceOutput"]`

**After:**
- Single source action: Monorepo (`slampenny/bianca-app`)
- Buildspec: `buildspec-staging.yml` (root)
- Input artifacts: `["SourceOutput"]`

### 3. Updated Production Pipeline
**File:** `packages/backend/devops/terraform/codepipeline-production.tf`

- **Removed separate FrontendSource action** - No longer needed since frontend is in the monorepo
- **Updated buildspec path** from `devops/buildspec-production.yml` to `buildspec-production.yml` (root)
- **Updated input artifacts** to only use `SourceOutput` (removed `FrontendSourceOutput`)

**Before:**
- Two source actions: Backend (`slampenny/bianca-app-backend`) and Frontend (`slampenny/bianca-app-frontend`)
- Buildspec: `devops/buildspec-production.yml`
- Input artifacts: `["SourceOutput", "FrontendSourceOutput"]`

**After:**
- Single source action: Monorepo (`slampenny/bianca-app`)
- Buildspec: `buildspec-production.yml` (root)
- Input artifacts: `["SourceOutput"]`

## Pipeline Behavior

### Before (Separate Repos)
- CodePipeline pulled from two separate repositories
- Backend changes triggered backend builds
- Frontend changes triggered frontend builds
- Two separate source artifacts

### After (Monorepo)
- CodePipeline pulls from single monorepo repository (`slampenny/bianca-app`)
- Buildspec uses change detection to only build what changed
- Single source artifact contains both backend and frontend
- Buildspec paths point to root-level buildspec files

## Buildspec Files

The pipelines now reference root-level buildspec files:
- **Staging:** `buildspec-staging.yml` (at repo root)
- **Production:** `buildspec-production.yml` (at repo root)

These buildspec files include:
- Change detection script (`scripts/detect-changes.sh`)
- Conditional builds based on what changed
- Monorepo-aware paths (`packages/backend/`, `packages/frontend/`)

## Next Steps

1. **Apply Terraform changes:**
   ```bash
   cd packages/backend/devops/terraform
   terraform plan
   terraform apply
   ```

2. **Verify pipelines:**
   - Check that pipelines pull from `slampenny/bianca-app`
   - Verify buildspec paths are correct
   - Test a deployment to ensure change detection works

3. **Update any manual pipeline configurations:**
   - If pipelines were manually configured in AWS Console, update them to use the monorepo
   - Remove any separate frontend source configurations

## Rollback

If you need to rollback:
1. Revert the variable default to `"bianca-app-backend"`
2. Restore the FrontendSource actions in both pipeline files
3. Change buildspec paths back to `devops/buildspec-*.yml`
4. Restore `FrontendSourceOutput` in input_artifacts
