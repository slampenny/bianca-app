# Maintenance Mode

This directory contains scripts and assets for enabling maintenance mode during deployments.

## Overview

When deploying, the site shows a 502 error while containers are restarting. This maintenance mode system shows a friendly maintenance page instead.

## Setup

### 1. Upload Maintenance Page to S3

First, upload the maintenance page to S3:

```bash
cd bianca-app-backend/devops/maintenance
./upload-to-s3.sh
```

This will:
- Create an S3 bucket `bianca-maintenance-pages` (if it doesn't exist)
- Upload `maintenance.html` to the bucket
- Make it publicly readable

You can customize the bucket name by setting the `MAINTENANCE_S3_BUCKET` environment variable:

```bash
MAINTENANCE_S3_BUCKET=my-custom-bucket ./upload-to-s3.sh
```

### 2. Configure IAM Permissions

Ensure your EC2 instances have IAM permissions to:
- Read from the S3 bucket: `s3:GetObject` on `s3://bianca-maintenance-pages/*`
- List the bucket: `s3:ListBucket` on `s3://bianca-maintenance-pages`

Example IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::bianca-maintenance-pages",
        "arn:aws:s3:::bianca-maintenance-pages/*"
      ]
    }
  ]
}
```

## How It Works

1. **Before Deployment Starts** (`before_install.sh`):
   - Calls `enable-maintenance.sh`
   - Downloads maintenance page from S3 to `/opt/maintenance.html`
   - Creates flag file `/opt/maintenance-mode.flag`
   - Nginx checks for this flag and serves maintenance page if it exists

2. **During Deployment**:
   - Nginx continues running and serves the maintenance page
   - Containers are stopped, updated, and restarted
   - Users see the maintenance page instead of 502 errors

3. **After Deployment** (`validate_service.sh`):
   - Once containers are healthy, calls `disable-maintenance.sh`
   - Removes the flag file
   - Nginx reloads and serves normal content

## Manual Usage

### Enable Maintenance Mode

```bash
./enable-maintenance.sh
```

### Disable Maintenance Mode

```bash
./disable-maintenance.sh
```

## Customization

### Modify Maintenance Page

Edit `maintenance.html` and re-upload to S3:

```bash
# Edit the file
vim maintenance.html

# Re-upload
./upload-to-s3.sh
```

### Custom S3 Bucket

Set the bucket name via environment variable:

```bash
export MAINTENANCE_S3_BUCKET=my-custom-bucket
./enable-maintenance.sh
./disable-maintenance.sh
```

## Files

- `maintenance.html` - The maintenance page HTML
- `enable-maintenance.sh` - Script to enable maintenance mode
- `disable-maintenance.sh` - Script to disable maintenance mode
- `upload-to-s3.sh` - Script to upload maintenance page to S3

## Integration

The maintenance mode is automatically integrated into the CodeDeploy lifecycle:

- **BeforeInstall**: Enables maintenance mode
- **ValidateService**: Disables maintenance mode after successful deployment

No manual intervention needed during normal deployments!


