#!/bin/bash
# Script to push BUILD_NOTES.md to Confluence
# This script will create or update a "Build Notes" page in Confluence

set -e

CONFLUENCE_URL="${CONFLUENCE_URL:-https://biancatechnologies.atlassian.net}"
SPACE_KEY="${SPACE_KEY:-BTD}"
BUILD_NOTES_FILE="${BUILD_NOTES_FILE:-../../BUILD_NOTES.md}"
PAGE_TITLE="${PAGE_TITLE:-Build Notes}"

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

# Get credentials
if [ -z "$CONFLUENCE_EMAIL" ]; then
    if [ -t 0 ]; then
        read -p "Enter your Confluence email: " CONFLUENCE_EMAIL
    else
        echo "Error: CONFLUENCE_EMAIL environment variable is required"
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
        echo "Error: CONFLUENCE_API_TOKEN environment variable is required"
        exit 1
    fi
fi

# Check if BUILD_NOTES.md exists
if [ ! -f "$BUILD_NOTES_FILE" ]; then
    echo "❌ Error: BUILD_NOTES.md not found at $BUILD_NOTES_FILE"
    echo "   Current directory: $(pwd)"
    exit 1
fi

echo "✅ Found BUILD_NOTES.md"
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

# Function to convert markdown to Confluence storage format
# Improved version that handles code blocks, lists, and other markdown features
convert_markdown_to_confluence() {
    local markdown="$1"
    
    # Use a temporary file for processing
    local temp_file=$(mktemp)
    echo "$markdown" > "$temp_file"
    
    # Process code blocks first (before other conversions)
    # Convert ```language blocks to {code:language}...{code}
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
    
    # Handle headers (must be done line by line)
    content=$(echo "$content" | \
        sed -E 's/^# (.*)$/h1. \1/' | \
        sed -E 's/^## (.*)$/h2. \1/' | \
        sed -E 's/^### (.*)$/h3. \1/' | \
        sed -E 's/^#### (.*)$/h4. \1/' | \
        sed -E 's/^##### (.*)$/h5. \1/' | \
        sed -E 's/^###### (.*)$/h6. \1/')
    
    # Handle bold (**text** or __text__)
    content=$(echo "$content" | sed -E 's/\*\*([^\*]+)\*\*/*\1*/g' | sed -E 's/__([^_]+)__/*\1*/g')
    
    # Handle inline code (`code`) - simple replacement
    # Note: This might affect code inside code blocks, but Confluence code blocks handle this
    content=$(echo "$content" | sed -E 's/`([^`]+)`/{{ \1 }}/g')
    
    # Handle links [text](url)
    content=$(echo "$content" | sed -E 's/\[([^\]]+)\]\(([^\)]+)\)/[\1|\2]/g')
    
    # Handle horizontal rules (---)
    content=$(echo "$content" | sed -E 's/^---$/----/g')
    
    # Handle bullet lists (- and *) - preserve indentation
    content=$(echo "$content" | awk '
        {
            if (/^(\s*)[-*] /) {
                # Extract indentation
                match($0, /^(\s*)[-*] /, arr)
                indent = arr[1]
                # Count spaces for Confluence list depth
                depth = length(indent) / 2
                if (depth < 1) depth = 1
                # Replace with Confluence list format
                sub(/^(\s*)[-*] /, "")
                for (i = 1; i < depth; i++) printf "* "
                printf "* %s\n", $0
            } else {
                print
            }
        }
    ')
    
    # Handle numbered lists - preserve indentation
    content=$(echo "$content" | awk '
        {
            if (/^(\s*)[0-9]+\. /) {
                # Extract indentation
                match($0, /^(\s*)[0-9]+\. /, arr)
                indent = arr[1]
                # Count spaces for Confluence list depth
                depth = length(indent) / 2
                if (depth < 1) depth = 1
                # Replace with Confluence list format
                sub(/^(\s*)[0-9]+\. /, "")
                for (i = 1; i < depth; i++) printf "# "
                printf "# %s\n", $0
            } else {
                print
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
        echo "View page: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PAGE_ID"
    else
        echo ""
        echo "❌ Failed to update page"
        exit 1
    fi
else
    echo "No existing page found"
    echo ""
    echo "Creating new page..."
    
    PAGE_ID=$(create_page "$PAGE_TITLE" "$CONFLUENCE_CONTENT" 2>&1 | tail -1)
    
    if [ -n "$PAGE_ID" ] && [ "$PAGE_ID" != "null" ] && [[ "$PAGE_ID" =~ ^[0-9]+$ ]]; then
        echo ""
        echo "✅ Build Notes successfully created in Confluence!"
        echo ""
        echo "View page: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PAGE_ID"
    else
        echo ""
        echo "❌ Failed to create page"
        echo "Response: $PAGE_ID"
        exit 1
    fi
fi

echo ""
echo "Done! 🎉"

