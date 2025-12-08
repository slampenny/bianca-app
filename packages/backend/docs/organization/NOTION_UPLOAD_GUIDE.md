# Uploading Documentation to Notion

This guide explains how to upload your markdown documentation to Notion.

## 🚀 Quick Methods

### Method 1: Manual Import (Easiest)
1. Go to your Notion workspace
2. Click "Import" in the sidebar or press `Ctrl/Cmd + I`
3. Select "Markdown" as the file type
4. Upload your `docs/` folder or individual `.md` files
5. Notion will automatically convert markdown to Notion blocks

### Method 2: Copy & Paste (Quick for individual files)
1. Open any `.md` file in your editor
2. Copy all content (`Ctrl/Cmd + A`, then `Ctrl/Cmd + C`)
3. Go to Notion and create a new page
4. Paste (`Ctrl/Cmd + V`) - Notion will auto-convert the markdown

## 🤖 Automated Upload (For bulk upload)

### Prerequisites
1. **Install Notion client**:
   ```bash
   npm install @notionhq/client
   ```

2. **Get Notion Integration Token**:
   - Go to https://www.notion.so/my-integrations
   - Create a new integration
   - Copy the "Internal Integration Token"

3. **Create a Notion page** to receive the documentation:
   - Create a new page in your Notion workspace
   - Copy the page ID from the URL (the long string after the last `/`)

### Setup Environment Variables
```bash
export NOTION_TOKEN="your_integration_token_here"
export NOTION_PARENT_PAGE_ID="your_page_id_here"
```

### Run the Upload Script
```bash
node scripts/upload-to-notion.js
```

## 📋 What Gets Uploaded

The script will upload all `.md` files from the `docs/` directory:
- `EMERGENCY_SYSTEM.md`
- `CALL_WORKFLOW_README.md`
- `SENTIMENT_ANALYSIS_API.md`
- `testing-strategy.md`
- And all other documentation files

## 🔧 Customization

You can modify the script to:
- Upload to a specific Notion database instead of pages
- Add custom properties to each page
- Filter which files to upload
- Add custom formatting

## 🆘 Troubleshooting

**"Notion API error"**: Make sure your integration token is correct and has access to the target page.

**"Page not found"**: Verify the `NOTION_PARENT_PAGE_ID` is correct and the integration has access to it.

**"Rate limit exceeded"**: The script includes a 1-second delay between uploads to avoid rate limits.

## 📝 Tips

1. **Organize in Notion**: After upload, you can organize the pages into a hierarchical structure
2. **Add tags**: Use Notion's tagging system to categorize your documentation
3. **Create templates**: Set up page templates for consistent documentation formatting
4. **Link between pages**: Use Notion's linking features to connect related documentation
