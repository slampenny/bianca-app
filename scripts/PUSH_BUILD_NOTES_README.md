# Push Build Notes to Confluence

This script automatically pushes `BUILD_NOTES.md` to your Confluence instance.

## Quick Start

### Manual Run

```bash
cd /home/jordanlapp/code/bianca-app/bianca-app-backend/scripts

# Set your credentials
export CONFLUENCE_EMAIL="your-email@example.com"
export CONFLUENCE_API_TOKEN="your-api-token"

# Run the script
./push-build-notes-to-confluence.sh
```

### Get Your Confluence API Token

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a name (e.g., "Build Notes Automation")
4. Copy the token (you'll only see it once!)

## Features

- ✅ **Auto-update**: If a "Build Notes" page already exists, it will be updated
- ✅ **Auto-create**: If no page exists, a new one will be created
- ✅ **Markdown conversion**: Converts markdown to Confluence storage format
- ✅ **Safe**: Tests connection before attempting to push

## Configuration

You can customize the script behavior with environment variables:

```bash
# Confluence instance URL (default: https://biancatechnologies.atlassian.net)
export CONFLUENCE_URL="https://your-instance.atlassian.net"

# Confluence space key (default: BTD)
export SPACE_KEY="YOUR_SPACE_KEY"

# Path to BUILD_NOTES.md (default: ../../BUILD_NOTES.md)
export BUILD_NOTES_FILE="/path/to/BUILD_NOTES.md"

# Page title in Confluence (default: Build Notes)
export PAGE_TITLE="Build Notes"
```

## Automation

### GitHub Actions

You can automate this by adding a GitHub Actions workflow. Create `.github/workflows/push-build-notes.yml`:

```yaml
name: Push Build Notes to Confluence

on:
  push:
    branches:
      - main
    paths:
      - 'BUILD_NOTES.md'
  workflow_dispatch:  # Allow manual trigger

jobs:
  push-to-confluence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Push Build Notes to Confluence
        env:
          CONFLUENCE_EMAIL: ${{ secrets.CONFLUENCE_EMAIL }}
          CONFLUENCE_API_TOKEN: ${{ secrets.CONFLUENCE_API_TOKEN }}
        run: |
          cd bianca-app-backend/scripts
          ./push-build-notes-to-confluence.sh
```

### Required GitHub Secrets

Add these secrets to your GitHub repository:

1. `CONFLUENCE_EMAIL` - Your Confluence email address
2. `CONFLUENCE_API_TOKEN` - Your Confluence API token

### GitLab CI/CD

Add to your `.gitlab-ci.yml`:

```yaml
push_build_notes:
  stage: deploy
  only:
    - main
  changes:
    - BUILD_NOTES.md
  script:
    - cd bianca-app-backend/scripts
    - ./push-build-notes-to-confluence.sh
  variables:
    CONFLUENCE_EMAIL: $CONFLUENCE_EMAIL
    CONFLUENCE_API_TOKEN: $CONFLUENCE_API_TOKEN
```

### Local Cron Job

To run automatically on a schedule:

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 9 AM
0 9 * * * cd /home/jordanlapp/code/bianca-app/bianca-app-backend/scripts && CONFLUENCE_EMAIL="your-email@example.com" CONFLUENCE_API_TOKEN="your-token" ./push-build-notes-to-confluence.sh >> /tmp/confluence-build-notes.log 2>&1
```

## Troubleshooting

### "jq command not found"
Install jq:
```bash
sudo apt install jq  # Ubuntu/Debian
# or
brew install jq      # macOS
```

### "curl command not found"
Install curl:
```bash
sudo apt install curl  # Ubuntu/Debian
# or
brew install curl      # macOS
```

### "Authentication failed"
- Double-check your email and API token
- Make sure the token was copied correctly (no extra spaces)
- Try creating a new API token

### "Space not found"
- Verify the space key is correct (default: `BTD`)
- Make sure you have permission to create/update pages in that space

### Markdown formatting issues
The script uses a basic markdown-to-Confluence converter. Some complex markdown features might not convert perfectly. You can:
- Manually adjust formatting in Confluence after import
- Use Confluence's built-in markdown import feature
- Improve the `convert_markdown_to_confluence()` function in the script

## Notes

- The script will update an existing page if one with the same title exists
- Code blocks are converted to Confluence's `{code}` macro
- Links are converted to Confluence link format
- Headers are converted to Confluence header format (h1., h2., etc.)


