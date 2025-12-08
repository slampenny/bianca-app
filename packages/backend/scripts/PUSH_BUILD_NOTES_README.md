# Push Build Notes to Confluence

This script manually pushes `BUILD_NOTES.md` to your Confluence instance. Run it whenever you want to update the Build Notes page in Confluence.

## Quick Start

### Setup (One Time)

The script reads credentials from the `.env` file in the backend directory. Credentials have already been added to your `.env` file.

If you need to update them, add these lines to `bianca-app-backend/.env`:

```bash
CONFLUENCE_EMAIL=admin@biancatechnologies.com
CONFLUENCE_API_TOKEN=your-api-token-here
```

**Note:** The `.env` file is already in `.gitignore`, so your credentials won't be committed to git.

### Manual Run

```bash
cd /home/jordanlapp/code/bianca-app/bianca-app-backend/scripts

# Run the script (it will automatically read from .env)
./push-build-notes-to-confluence.sh
```

The script will automatically load credentials from `bianca-app-backend/.env`. No need to set environment variables manually!

### Get Your Confluence API Token

If you need to create a new API token:

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a name (e.g., "Build Notes Automation")
4. Copy the token and add it to your `.env` file

## Features

- ✅ **Auto-update**: If a "Build Notes" page already exists, it will be updated
- ✅ **Auto-create**: If no page exists, a new one will be created
- ✅ **Parent page support**: Automatically creates "Deployment" parent page if it doesn't exist, then places Build Notes under it
- ✅ **Markdown conversion**: Converts markdown to Confluence storage format
- ✅ **Safe**: Tests connection before attempting to push

## Where Build Notes Are Placed

The script will create/update the "Build Notes" page in your Confluence space:

- **Space**: `BTD` (Bianca Technologies Documentation)
- **Parent Page**: `Deployment` (automatically created if it doesn't exist)
- **Page Title**: `Build Notes`

The script will automatically create the "Deployment" parent page via the API if it doesn't exist, then place Build Notes under it. This keeps your documentation organized alongside other category pages like "Emergency System", "AI & Machine Learning", etc.

## Configuration

### Credentials (in .env file)

Add to `bianca-app-backend/.env`:
```bash
CONFLUENCE_EMAIL=admin@biancatechnologies.com
CONFLUENCE_API_TOKEN=your-api-token-here
```

### Optional Configuration

You can customize the script behavior with environment variables (or add to .env):

```bash
# Confluence instance URL (default: https://biancatechnologies.atlassian.net)
export CONFLUENCE_URL="https://your-instance.atlassian.net"

# Confluence space key (default: BTD)
export SPACE_KEY="YOUR_SPACE_KEY"

# Path to BUILD_NOTES.md (default: root project BUILD_NOTES.md)
# Note: This script pushes the root BUILD_NOTES.md, not subdirectory versions
export BUILD_NOTES_FILE="/path/to/BUILD_NOTES.md"

# Page title in Confluence (default: Build Notes)
export PAGE_TITLE="Build Notes"

# Parent page title (default: Deployment)
# Set to empty string to create at top level
export PARENT_PAGE_TITLE="Deployment"
```

## Automation

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
- Double-check your email and API token in the `.env` file
- Make sure the token was copied correctly (no extra spaces)
- Verify the `.env` file is in `bianca-app-backend/.env`
- Try creating a new API token

### ".env file not found"
- Make sure you're running the script from `bianca-app-backend/scripts/`
- The script looks for `.env` in `bianca-app-backend/.env` (one directory up from scripts)
- You can override the path with: `ENV_FILE=/path/to/.env ./push-build-notes-to-confluence.sh`

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


