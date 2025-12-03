# Playwright E2E Test Pipeline

## Overview

This is a separate CodePipeline that runs Playwright E2E tests independently of the main deployment pipeline. It can be triggered manually or automatically on code changes.

## Files Created

1. **`terraform/playwright-test-pipeline.tf`** - Terraform configuration for:
   - CodeBuild project: `bianca-playwright-e2e-tests`
   - CodePipeline: `BiancaPlaywright-Test-Pipeline`

2. **`buildspec-playwright.yml`** - Buildspec that:
   - Starts MongoDB in Docker
   - Starts backend server
   - Seeds test database
   - Starts frontend server
   - Runs Playwright tests
   - Uploads test artifacts

## Pipeline Structure

```
Source Stage
  ├── FrontendSource (from frontend repo)
  └── BackendSource (from backend repo)
    ↓
Test Stage
  └── PlaywrightTests (CodeBuild)
```

## Deployment

1. **Navigate to Terraform directory:**
   ```bash
   cd bianca-app-frontend/devops/terraform
   ```

2. **Initialize Terraform (if needed):**
   ```bash
   terraform init
   ```

3. **Review the plan:**
   ```bash
   terraform plan
   ```

4. **Apply the changes:**
   ```bash
   terraform apply
   ```

## Configuration

### Variables

The pipeline uses these variables (with defaults):
- `frontend_github_owner`: "slampenny"
- `frontend_github_repo`: "bianca-app-frontend"
- `frontend_github_branch`: "main"
- `github_owner`: "jordanlapp"
- `github_repo`: "bianca-app-backend"
- `github_branch`: "main"
- `github_app_connection_arn`: (from existing config)

### Override Variables

To use different branches or repos, create a `terraform.tfvars` file:

```hcl
frontend_github_branch = "staging"
github_branch = "staging"
```

## Usage

### Manual Trigger

1. Go to AWS CodePipeline console
2. Find `BiancaPlaywright-Test-Pipeline`
3. Click "Release change"

### Automatic Trigger

The pipeline automatically runs when:
- Code is pushed to the configured branches
- Pull requests are merged (if configured)

### Viewing Results

1. **In CodePipeline:**
   - Go to the pipeline execution
   - Click on the "Test" stage
   - View CodeBuild logs

2. **Test Artifacts:**
   - Test reports are uploaded to S3
   - Download from the pipeline execution artifacts
   - HTML report: `playwright-report/index.html`
   - Videos/screenshots: `test-results/`

3. **CloudWatch Logs:**
   - Log group: `/aws/codebuild/bianca-playwright-e2e-tests`

## Troubleshooting

### Backend/Frontend Won't Start

Check the CodeBuild logs in CloudWatch. Common issues:
- MongoDB not ready (check Docker container)
- Port conflicts (3000 or 8081 already in use)
- Missing dependencies

### Tests Fail

1. Check test artifacts in S3
2. Review videos/screenshots for UI issues
3. Check backend logs in CodeBuild output
4. Verify database was seeded correctly

### Backend Source Not Found

The buildspec looks for backend in artifact location `s3/01`. If backend is in a different location:
- Check CodePipeline source stage configuration
- Verify both source actions are configured correctly
- Check buildspec artifact location logic

## Cost Considerations

- **CodeBuild**: ~$0.005 per minute for BUILD_GENERAL1_LARGE
- **Estimated test time**: 10-15 minutes
- **Cost per run**: ~$0.05-0.075
- **Monthly (20 runs)**: ~$1-1.50

## Next Steps

1. Deploy the Terraform configuration
2. Run the pipeline manually to test
3. Configure automatic triggers (if desired)
4. Set up notifications (SNS) for test failures (optional)


