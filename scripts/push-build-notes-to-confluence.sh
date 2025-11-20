#!/bin/bash
# Script to push BUILD_NOTES.md to Confluence
# This script will create or update a "Build Notes" page in Confluence

set -e

CONFLUENCE_URL="${CONFLUENCE_URL:-https://biancatechnologies.atlassian.net}"
SPACE_KEY="${SPACE_KEY:-BTD}"

# Determine script directory and calculate path to root BUILD_NOTES.md
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# From bianca-app-backend/scripts/, go up two levels to reach project root
ROOT_BUILD_NOTES="${SCRIPT_DIR}/../../BUILD_NOTES.md"
BUILD_NOTES_FILE="${BUILD_NOTES_FILE:-$ROOT_BUILD_NOTES}"
PAGE_TITLE="${PAGE_TITLE:-Build Notes}"
PARENT_PAGE_TITLE="${PARENT_PAGE_TITLE:-Deployment}"

echo "=========================================="
echo "Push Build Notes to Confluence"
echo "=========================================="
echo ""

# Check if required tools are installed
if ! command -v curl &> /dev/null; then
    echo "❌ Error: curl is required but not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed"
    exit 1
fi

# Load credentials from .env file
# SCRIPT_DIR already set above
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env}"
if [ -f "$ENV_FILE" ]; then
    echo "Loading credentials from .env file..."
    # Read .env file and export variables (handles comments, empty lines, and quoted values)
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        # Remove leading/trailing whitespace
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        # Export the variable (handles KEY=VALUE format)
        if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            export "$line" 2>/dev/null || true
        fi
    done < "$ENV_FILE"
    set +a
    echo "✅ Loaded .env file"
else
    echo "⚠️  Warning: .env file not found at $ENV_FILE"
    echo "   Falling back to environment variables or interactive input"
fi

# Get credentials (from .env, environment, or interactive)
if [ -z "$CONFLUENCE_EMAIL" ]; then
    if [ -t 0 ]; then
        read -p "Enter your Confluence email: " CONFLUENCE_EMAIL
    else
        echo "Error: CONFLUENCE_EMAIL not found in .env file or environment variables"
        echo "   Add CONFLUENCE_EMAIL=your-email@example.com to $ENV_FILE"
        exit 1
    fi
fi

if [ -z "$CONFLUENCE_API_TOKEN" ]; then
    if [ -t 0 ]; then
        echo ""
        echo "To get your API token:"
        echo "1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens"
        echo "2. Click 'Create API token'"
        echo "3. Copy the token"
        echo ""
        read -sp "Enter your Confluence API token: " CONFLUENCE_API_TOKEN
        echo ""
    else
        echo "Error: CONFLUENCE_API_TOKEN not found in .env file or environment variables"
        echo "   Add CONFLUENCE_API_TOKEN=your-token to $ENV_FILE"
        exit 1
    fi
fi

# Check if BUILD_NOTES.md exists
if [ ! -f "$BUILD_NOTES_FILE" ]; then
    echo "❌ Error: BUILD_NOTES.md not found at $BUILD_NOTES_FILE"
    echo "   Expected location: Root project folder (../../BUILD_NOTES.md from scripts/)"
    echo "   Current directory: $(pwd)"
    echo ""
    echo "   Note: This script pushes the root BUILD_NOTES.md, not:"
    echo "   - bianca-app-backend/BUILD_NOTES.md"
    echo "   - bianca-app-frontend/BUILD_NOTES.md"
    exit 1
fi

# Verify we're using the root BUILD_NOTES.md (not a subdirectory one)
BUILD_NOTES_DIR=$(dirname "$BUILD_NOTES_FILE")
if [[ "$BUILD_NOTES_DIR" == *"/bianca-app-backend" ]] || [[ "$BUILD_NOTES_DIR" == *"/bianca-app-frontend" ]]; then
    echo "⚠️  Warning: BUILD_NOTES.md appears to be in a subdirectory"
    echo "   Using: $BUILD_NOTES_FILE"
    echo "   This script is designed to push the root BUILD_NOTES.md"
    echo ""
fi

echo "✅ Found BUILD_NOTES.md at: $BUILD_NOTES_FILE"
echo ""

# Test connection to Confluence
echo "Testing connection to Confluence..."
RESPONSE=$(curl -s --max-time 15 -w "\n%{http_code}" \
    -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "$CONFLUENCE_URL/wiki/rest/api/space/$SPACE_KEY" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Error connecting to Confluence (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    exit 1
fi

echo "✅ Connected to Confluence!"
echo ""

# Function to find existing page by title
find_page_by_title() {
    local title="$1"
    
    RESPONSE=$(curl -s --max-time 10 -w "\n%{http_code}" \
        -X GET \
        -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
        -H "Content-Type: application/json" \
        "$CONFLUENCE_URL/wiki/rest/api/content?spaceKey=$SPACE_KEY&title=$(echo "$title" | sed 's/ /%20/g')&expand=version" 2>/dev/null)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        PAGE_ID=$(echo "$BODY" | jq -r '.results[0].id // empty' 2>/dev/null)
        VERSION=$(echo "$BODY" | jq -r '.results[0].version.number // empty' 2>/dev/null)
        
        if [ -n "$PAGE_ID" ] && [ "$PAGE_ID" != "null" ]; then
            echo "$PAGE_ID|$VERSION"
            return 0
        fi
    fi
    
    return 1
}

# Function to convert markdown to Confluence storage format (HTML-based)
# Confluence storage format uses HTML, not wiki markup
convert_markdown_to_confluence() {
    local markdown="$1"
    
    # Use a temporary file for processing
    local temp_file=$(mktemp)
    echo "$markdown" > "$temp_file"
    
    # Process code blocks first (before other conversions)
    # Convert ```language blocks to {code:language}...{code} (this is correct for storage format)
    awk '
        BEGIN { in_code = 0; code_lang = "" }
        /^```/ {
            if (in_code == 0) {
                in_code = 1
                code_lang = substr($0, 4)
                gsub(/^[ \t]+|[ \t]+$/, "", code_lang)
                if (code_lang == "" || code_lang == "bash" || code_lang == "sh") code_lang = "bash"
                else if (code_lang == "js" || code_lang == "javascript") code_lang = "javascript"
                else if (code_lang == "ts" || code_lang == "typescript") code_lang = "typescript"
                else if (code_lang == "json") code_lang = "json"
                else if (code_lang == "yaml" || code_lang == "yml") code_lang = "yaml"
                else if (code_lang == "md" || code_lang == "markdown") code_lang = "markdown"
                else code_lang = "none"
                print "{code:" code_lang "}"
            } else {
                in_code = 0
                print "{code}"
            }
            next
        }
        in_code == 1 { print }
        in_code == 0 { print }
    ' "$temp_file" > "${temp_file}.processed"
    mv "${temp_file}.processed" "$temp_file"
    
    # Read processed content
    local content=$(cat "$temp_file")
    
    # Handle headers - use HTML format for storage representation
    content=$(echo "$content" | \
        sed -E 's/^# (.*)$/<h1>\1<\/h1>/' | \
        sed -E 's/^## (.*)$/<h2>\1<\/h2>/' | \
        sed -E 's/^### (.*)$/<h3>\1<\/h3>/' | \
        sed -E 's/^#### (.*)$/<h4>\1<\/h4>/' | \
        sed -E 's/^##### (.*)$/<h5>\1<\/h5>/' | \
        sed -E 's/^###### (.*)$/<h6>\1<\/h6>/')
    
    # Handle bold (**text** or __text__) - use <strong> tags
    content=$(echo "$content" | sed -E 's/\*\*([^\*]+)\*\*/<strong>\1<\/strong>/g' | sed -E 's/__([^_]+)__/<strong>\1<\/strong>/g')
    
    # Handle inline code (`code`) - use <code> tags for storage format
    # Note: We need to be careful not to replace code inside code blocks
    # Process line by line, skipping lines that are inside code blocks
    # Use sed first to handle inline code (before awk processes code blocks)
    content=$(echo "$content" | sed -E 's/`([^`]+)`/<code>\1<\/code>/g')
    
    # Now process code blocks and protect inline code inside them
    content=$(echo "$content" | awk '
        BEGIN { in_code_block = 0 }
        /^\{code/ { 
            in_code_block = 1
            print
            next
        }
        /^\{code\}$/ { 
            in_code_block = 0
            print
            next
        }
        {
            if (in_code_block) {
                # Inside code block - restore backticks if they were converted
                gsub(/<code>/, "`")
                gsub(/<\/code>/, "`")
                print
            } else {
                # Outside code block - keep the <code> tags
                print
            }
        }
    ')
    
    # Handle links [text](url) - use Confluence link format
    content=$(echo "$content" | sed -E 's/\[([^\]]+)\]\(([^\)]+)\)/[\1|\2]/g')
    
    # Handle horizontal rules (---) - use <hr/> tag
    content=$(echo "$content" | sed -E 's/^---$/<hr\/>/g')
    
    # Handle bullet lists (- and *) - convert to HTML <ul><li> format
    content=$(echo "$content" | awk '
        BEGIN { in_list = 0; list_depth = 0 }
        {
            if (/^(\s*)[-*] /) {
                # Extract indentation
                match($0, /^(\s*)[-*] /, arr)
                indent = arr[1]
                depth = int(length(indent) / 2) + 1
                
                # Close/open list tags as needed
                while (list_depth >= depth) {
                    print "</ul>"
                    list_depth--
                }
                while (list_depth < depth - 1) {
                    print "<ul>"
                    list_depth++
                }
                if (list_depth == 0) {
                    print "<ul>"
                    list_depth = 1
                }
                
                # Extract list item content
                sub(/^(\s*)[-*] /, "")
                print "<li>" $0 "</li>"
                in_list = 1
            } else if (/^(\s*)[0-9]+\. /) {
                # Numbered list - similar handling
                match($0, /^(\s*)[0-9]+\. /, arr)
                indent = arr[1]
                depth = int(length(indent) / 2) + 1
                
                while (list_depth >= depth) {
                    if (list_depth > 0) print "</ol>"
                    list_depth--
                }
                while (list_depth < depth - 1) {
                    print "<ol>"
                    list_depth++
                }
                if (list_depth == 0) {
                    print "<ol>"
                    list_depth = 1
                }
                
                sub(/^(\s*)[0-9]+\. /, "")
                print "<li>" $0 "</li>"
                in_list = 1
            } else {
                # Not a list item
                if (in_list && list_depth > 0 && $0 !~ /^[[:space:]]*$/) {
                    # Close all open lists
                    while (list_depth > 0) {
                        print "</ul>"
                        print "</ol>"
                        list_depth--
                    }
                    in_list = 0
                }
                print
            }
        }
        END {
            while (list_depth > 0) {
                print "</ul>"
                print "</ol>"
                list_depth--
            }
        }
    ')
    
    # Clean up temp file
    rm -f "$temp_file"
    
    echo "$content"
}

# Function to create a new page
create_page() {
    local title="$1"
    local content="$2"
    local parent_id="${3:-}"
    
    local json_payload
    if [ -z "$parent_id" ]; then
        json_payload=$(jq -n \
            --arg title "$title" \
            --arg content "$content" \
            --arg space "$SPACE_KEY" \
            '{
                type: "page",
                title: $title,
                space: { key: $space },
                body: {
                    storage: {
                        value: $content,
                        representation: "storage"
                    }
                }
            }')
    else
        json_payload=$(jq -n \
            --arg title "$title" \
            --arg content "$content" \
            --arg space "$SPACE_KEY" \
            --arg parent "$parent_id" \
            '{
                type: "page",
                title: $title,
                space: { key: $space },
                ancestors: [{ id: $parent }],
                body: {
                    storage: {
                        value: $content,
                        representation: "storage"
                    }
                }
            }')
    fi
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        "$CONFLUENCE_URL/wiki/rest/api/content" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        PAGE_ID=$(echo "$BODY" | jq -r '.id')
        if [ -n "$PAGE_ID" ] && [ "$PAGE_ID" != "null" ]; then
            echo "$PAGE_ID"
            return 0
        else
            echo "Error: Failed to get page ID from response" >&2
            echo "$BODY" >&2
            return 1
        fi
    else
        echo "Error creating page: HTTP $HTTP_CODE" >&2
        echo "$BODY" >&2
        return 1
    fi
}

# Function to update an existing page
update_page() {
    local page_id="$1"
    local title="$2"
    local content="$3"
    local version="$4"
    
    local new_version=$((version + 1))
    
    json_payload=$(jq -n \
        --arg title "$title" \
        --arg content "$content" \
        --arg version "$new_version" \
        '{
            type: "page",
            title: $title,
            version: { number: ($version | tonumber) },
            body: {
                storage: {
                    value: $content,
                    representation: "storage"
                }
            }
        }')
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X PUT \
        -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        "$CONFLUENCE_URL/wiki/rest/api/content/$page_id" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Page updated successfully"
        return 0
    else
        echo "Error updating page: HTTP $HTTP_CODE" >&2
        echo "$BODY" >&2
        return 1
    fi
}

# Read and convert BUILD_NOTES.md
echo "Reading BUILD_NOTES.md..."
BUILD_NOTES_CONTENT=$(cat "$BUILD_NOTES_FILE")
echo "✅ Read $(wc -l < "$BUILD_NOTES_FILE") lines"

echo "Converting to Confluence format..."
CONFLUENCE_CONTENT=$(convert_markdown_to_confluence "$BUILD_NOTES_CONTENT")
echo "✅ Conversion complete"
echo ""

# Check for parent page (optional) and create if it doesn't exist
PARENT_ID=""
if [ -n "$PARENT_PAGE_TITLE" ]; then
    echo "Checking for parent page: '$PARENT_PAGE_TITLE'..."
    PARENT_INFO=$(find_page_by_title "$PARENT_PAGE_TITLE" 2>/dev/null || echo "")
    if [ -n "$PARENT_INFO" ]; then
        PARENT_ID=$(echo "$PARENT_INFO" | cut -d'|' -f1)
        echo "✅ Found parent page (ID: $PARENT_ID)"
        echo "   Build Notes will be created/updated under: $PARENT_PAGE_TITLE"
    else
        echo "⚠️  Parent page '$PARENT_PAGE_TITLE' not found"
        echo "   Creating parent page..."
        PARENT_ID=$(create_page "$PARENT_PAGE_TITLE" "This page contains deployment and release documentation." 2>&1 | tail -1)
        if [ -n "$PARENT_ID" ] && [ "$PARENT_ID" != "null" ] && [[ "$PARENT_ID" =~ ^[0-9]+$ ]]; then
            echo "✅ Created parent page '$PARENT_PAGE_TITLE' (ID: $PARENT_ID)"
            echo "   Build Notes will be created under: $PARENT_PAGE_TITLE"
        else
            echo "⚠️  Failed to create parent page, continuing without parent"
            echo "   Build Notes will be created at the top level"
            PARENT_ID=""
        fi
    fi
    echo ""
fi

# Check if page already exists
echo "Checking if page '$PAGE_TITLE' already exists..."
PAGE_INFO=$(find_page_by_title "$PAGE_TITLE" 2>/dev/null || echo "")

if [ -n "$PAGE_INFO" ]; then
    PAGE_ID=$(echo "$PAGE_INFO" | cut -d'|' -f1)
    VERSION=$(echo "$PAGE_INFO" | cut -d'|' -f2)
    echo "✅ Found existing page (ID: $PAGE_ID, Version: $VERSION)"
    echo ""
    echo "Updating existing page..."
    
    if update_page "$PAGE_ID" "$PAGE_TITLE" "$CONFLUENCE_CONTENT" "$VERSION"; then
        echo ""
        echo "✅ Build Notes successfully updated in Confluence!"
        echo ""
        if [ -n "$PARENT_ID" ]; then
            echo "View page: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PAGE_ID"
            echo "Parent page: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PARENT_ID"
        else
            echo "View page: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PAGE_ID"
        fi
    else
        echo ""
        echo "❌ Failed to update page"
        exit 1
    fi
else
    echo "No existing page found"
    echo ""
    echo "Creating new page..."
    
    PAGE_ID=$(create_page "$PAGE_TITLE" "$CONFLUENCE_CONTENT" "$PARENT_ID" 2>&1 | tail -1)
    
    if [ -n "$PAGE_ID" ] && [ "$PAGE_ID" != "null" ] && [[ "$PAGE_ID" =~ ^[0-9]+$ ]]; then
        echo ""
        echo "✅ Build Notes successfully created in Confluence!"
        echo ""
        if [ -n "$PARENT_ID" ]; then
            echo "Location: Under '$PARENT_PAGE_TITLE' parent page"
            echo "View page: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PAGE_ID"
            echo "Parent page: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PARENT_ID"
        else
            echo "Location: Top level of space"
            echo "View page: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PAGE_ID"
        fi
    else
        echo ""
        echo "❌ Failed to create page"
        echo "Response: $PAGE_ID"
        exit 1
    fi
fi

echo ""
echo "Done! 🎉"

