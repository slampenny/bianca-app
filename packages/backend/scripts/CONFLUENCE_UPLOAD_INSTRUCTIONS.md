# Upload Documentation to Confluence

This guide explains how to upload all organized documentation to Confluence while maintaining the folder structure.

## Prerequisites

1. **Confluence API Token:**
   - Go to: https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Copy the token (you'll only see it once!)

2. **Required Tools:**
   ```bash
   # Install jq if not already installed
   sudo apt install jq  # Ubuntu/Debian
   # or
   brew install jq      # macOS
   ```

## Quick Upload

```bash
cd /home/jordanlapp/code/bianca-app

# Set your Confluence credentials
export CONFLUENCE_EMAIL="your-email@example.com"
export CONFLUENCE_API_TOKEN="your-api-token-here"

# Optional: Override defaults
export CONFLUENCE_URL="https://biancatechnologies.atlassian.net"  # Default
export SPACE_KEY="BTD"  # Default

# Run the import script
./bianca-app-backend/scripts/import-all-docs-to-confluence.sh
```

## What Gets Uploaded

The script will:

1. **Exclude:**
   - `archive-obsolete-2025-11/` directory (obsolete docs)
   - All `README.md` files in subdirectories
   - Any other archive directories

2. **Organize by Category:**
   - 🔒 **HIPAA Compliance** - All `hipaa/` documentation
   - 📜 **Legal & Privacy** - All `legal/` documentation
   - 🚀 **Deployment & Operations** - All `deployment/` documentation
   - ⚙️ **Technical Documentation** - All `technical/` documentation
   - 📋 **Planning & Refactoring** - All `planning/` documentation
   - 📋 **Organization** - All `organization/` documentation
   - 🤖 **AI & Machine Learning** - All `ai-system/` documentation
   - 📚 **General Documentation** - Root-level docs

3. **Create Parent Pages:**
   - Each category gets a parent page
   - All documentation files become child pages under their category

## Documentation Structure in Confluence

```
📚 MyPhoneFriend Documentation
├── 🔒 HIPAA Compliance
│   ├── HIPAA Compliance Final Checklist
│   ├── HIPAA Backup System Ready
│   └── [all HIPAA docs]
├── 📜 Legal & Privacy
│   ├── Privacy Policy
│   ├── Notice of Privacy Practices
│   └── [all legal docs]
├── 🚀 Deployment & Operations
│   ├── Deployment
│   ├── Deployment Improvements
│   └── [all deployment docs]
├── ⚙️ Technical Documentation
│   ├── Architectural Review 2025
│   ├── Twilio Configuration
│   └── [all technical docs]
├── 📋 Planning & Refactoring
│   ├── Refactoring Plan
│   ├── Refactor Priorities
│   └── [all planning docs]
├── 📋 Organization
│   ├── Documentation Index
│   └── [all organization docs]
├── 🤖 AI & Machine Learning
│   ├── System Prompt Documentation
│   ├── Emergency System
│   └── [all AI docs]
└── 📚 General Documentation
    ├── README
    ├── INDEX
    └── [root-level docs]
```

## Troubleshooting

### "jq command not found"
```bash
sudo apt install jq  # Ubuntu/Debian
brew install jq      # macOS
```

### "Authentication failed"
- Double-check your email and API token
- Make sure the token was copied correctly (no extra spaces)
- Try creating a new API token

### "Space not found"
- Verify the space key is correct: `BTD`
- Make sure you have permission to create pages in that space

### Script fails but Confluence connection works
- The markdown-to-Confluence conversion is basic
- You may need to manually format some pages after import
- Or use Confluence's built-in import instead

## After Upload

1. **Review Pages:** Check that all pages were created correctly
2. **Fix Formatting:** Some markdown may need manual adjustment
3. **Add Links:** Link between related pages
4. **Create Index:** Update or create a main index page
5. **Add Labels:** Tag pages for easier discovery

## Notes

- The script skips files that already exist (won't overwrite)
- Each file is processed with a 1-second delay to avoid rate limiting
- Parent category pages are created automatically if they don't exist
- The script maintains the folder structure as category organization

