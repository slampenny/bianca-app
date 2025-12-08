# Importing Documentation to Confluence

## Quick Start

### Step 1: Clean Up Documentation (Remove Setup/Instruction Files)

```bash
cd /home/jordanlapp/code/bianca-app
./bianca-app-backend/scripts/cleanup-docs-for-confluence.sh
```

This will:
- Archive all Zoho/Email setup docs
- Remove troubleshooting guides
- Keep only actual system documentation (15 files)

### Step 2: Get Your Confluence API Token

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a name (e.g., "Documentation Import")
4. Copy the token (you'll only see it once!)

### Step 3: Run the Import Script

```bash
cd /home/jordanlapp/code/bianca-app

# Set your email (the one you use to log into Confluence)
export CONFLUENCE_EMAIL="your-email@example.com"

# Set your API token
export CONFLUENCE_API_TOKEN="your-api-token-here"

# Run the import
./bianca-app-backend/scripts/import-to-confluence.sh
```

The script will:
- Create category parent pages:
  - 🚨 Emergency System
  - 🧠 AI & Machine Learning
  - 💳 Billing & Payments
  - 🔄 Workflows & Integration
  - 🧪 Testing
  - 📚 General Documentation
- Import all 15 documentation files as child pages
- Organize them automatically

## Alternative: Manual Import (If Script Doesn't Work)

### Method 1: Confluence Built-in Import
1. Go to: https://biancatechnologies.atlassian.net/wiki/spaces/BTD
2. Click **"Create"** → **"Import"**
3. Select **"Markdown"** or **"Word"**
4. Upload the `docs/` folder (or zip it first)
5. Confluence will convert markdown automatically

### Method 2: Copy & Paste Individual Files
1. Open a `.md` file
2. Copy all content (`Ctrl/Cmd + A`, then `Ctrl/Cmd + C`)
3. In Confluence, create a new page
4. Paste (`Ctrl/Cmd + V`) - Confluence converts markdown

## Documentation Files That Will Be Imported

### 🚨 Emergency System
- EMERGENCY_SYSTEM.md
- EMERGENCY_INTEGRATION_GUIDE.md
- LOCALIZED_EMERGENCY_DETECTION.md

### 🧠 AI & Machine Learning
- AI_TEST_SUITE.md
- MEDICAL_ANALYSIS_API.md
- MEDICAL_TEST_SUITE.md
- SENTIMENT_ANALYSIS_API.md
- SENTIMENT_ANALYSIS_TESTS.md

### 💳 Billing & Payments
- BILLING_SYSTEM.md

### 🔄 Workflows & Integration
- CALL_WORKFLOW_README.md
- WORKFLOWS.md
- SNS_SETUP_GUIDE.md

### 🧪 Testing
- testing-strategy.md

### 📚 General Documentation
- README.md
- INDEX.md

**Total: 15 documentation files**

## Troubleshooting

### "jq command not found"
Install jq:
```bash
sudo apt install jq  # Ubuntu/Debian
# or
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

## After Import

1. **Organize pages**: Use Confluence's drag-and-drop to reorganize
2. **Add labels**: Tag pages for easier discovery
3. **Fix formatting**: Some markdown may need manual adjustment
4. **Add links**: Link between related pages
5. **Create index**: Update INDEX.md or create a Confluence index page
