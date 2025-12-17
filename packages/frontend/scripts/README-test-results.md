# Playwright Test Results Viewer

This directory contains scripts to easily view and diagnose Playwright test failures from AWS CodeBuild runs.

## Overview

When Playwright tests run in the AWS pipeline, test results are automatically uploaded to S3 for easy access. This includes:

- **HTML Report**: Full interactive Playwright HTML report with screenshots, videos, and traces
- **JUnit XML**: Structured test results for CI/CD integration
- **Test Artifacts**: Screenshots, videos, and traces for failed tests
- **Container Logs**: Backend and frontend container logs
- **Playwright Output**: Full test execution log

## Quick Start

### View Latest Test Failures

```bash
cd packages/frontend
./scripts/get-test-failures.sh
```

This quickly shows which tests failed in the most recent run.

### Download and View Full Test Results

```bash
cd packages/frontend
./scripts/view-test-results.sh
```

This downloads all test artifacts and opens the HTML report in your browser.

### View Specific Build

```bash
./scripts/view-test-results.sh <build-number>
```

Example:
```bash
./scripts/view-test-results.sh 42
```

## What Gets Uploaded

After each test run, the following is uploaded to S3:

```
s3://bianca-codedeploy-artifacts-<account-id>/test-results/<build-number>-<build-id>/
├── playwright-report/          # Interactive HTML report
│   └── index.html             # Main report (open this in browser)
├── test-results/              # Screenshots, videos, traces
│   ├── junit.xml             # JUnit XML for CI/CD
│   └── ...                   # Individual test artifacts
├── backend.log                # Backend container logs
├── frontend.log              # Frontend container logs
├── playwright-output.log     # Full Playwright test output
└── run-summary.txt           # Build summary and metadata
```

A `latest.json` marker file is also created at:
```
s3://bianca-codedeploy-artifacts-<account-id>/test-results/latest.json
```

## Accessing Results Directly

### Via AWS CLI

```bash
# List all test result builds
aws s3 ls s3://bianca-codedeploy-artifacts-<account-id>/test-results/ \
  --profile jordan

# Download latest HTML report
aws s3 sync s3://bianca-codedeploy-artifacts-<account-id>/test-results/<build-prefix>/playwright-report/ \
  ./playwright-report \
  --profile jordan

# View latest build info
aws s3 cp s3://bianca-codedeploy-artifacts-<account-id>/test-results/latest.json - \
  --profile jordan | jq
```

### Via AWS Console

1. Go to S3 Console
2. Navigate to `bianca-codedeploy-artifacts-<account-id>` bucket
3. Go to `test-results/` prefix
4. Find the build you want (or check `latest.json` for the latest)
5. Download `playwright-report/index.html` and open in browser

### Via CloudWatch Logs

Full build logs are also available in CloudWatch:
- Log Group: `/aws/codebuild/bianca-staging-tests`
- Region: `us-east-2` (or your configured region)

## Configuration

The scripts use these environment variables (with defaults):

- `AWS_PROFILE`: AWS CLI profile (default: `jordan`)
- `AWS_REGION`: AWS region (default: `us-east-2`)

Example:
```bash
AWS_PROFILE=my-profile AWS_REGION=us-west-2 ./scripts/view-test-results.sh
```

## Troubleshooting

### Script can't find test results

1. Check that the pipeline has run at least once
2. Verify AWS credentials: `aws sts get-caller-identity --profile jordan`
3. Check S3 bucket exists: `aws s3 ls s3://bianca-codedeploy-artifacts-* --profile jordan`

### HTML report won't open

The HTML report requires a local web server or file:// protocol. The script tries to open it automatically, but you can also:

```bash
# Using Python
python3 -m http.server 8000
# Then open http://localhost:8000/playwright-report/index.html

# Using Node.js
npx serve playwright-report
```

### JUnit XML parsing fails

Install `xmllint`:
```bash
# macOS
brew install libxml2

# Ubuntu/Debian
sudo apt-get install libxml2-utils
```

## Integration with CI/CD

The JUnit XML output can be integrated with CI/CD systems:

- **GitHub Actions**: Use `playwright-report-action` or similar
- **Jenkins**: Use JUnit plugin to parse `junit.xml`
- **GitLab CI**: Use `junit` artifact reporting

## For AI Assistants

When diagnosing test failures, you can:

1. Run `./scripts/get-test-failures.sh` to quickly see what failed
2. Download full results with `./scripts/view-test-results.sh`
3. Read the HTML report for visual debugging (screenshots, videos)
4. Check container logs for backend/frontend errors
5. Review `playwright-output.log` for full test execution details

The S3 location format is predictable:
```
s3://bianca-codedeploy-artifacts-<account-id>/test-results/<build-number>-<build-id>/
```

You can programmatically access test results using AWS CLI or SDK.
