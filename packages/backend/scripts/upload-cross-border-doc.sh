#!/bin/bash
# Script to upload just the Cross-Border Data Transfers document to Confluence

set -e

CONFLUENCE_URL="${CONFLUENCE_URL:-https://biancatechnologies.atlassian.net}"
SPACE_KEY="${SPACE_KEY:-BTD}"
DOC_FILE="packages/backend/docs/legal/CROSS_BORDER_DATA_TRANSFERS.md"
PARENT_CATEGORY="📜 Legal & Privacy"

# Determine script directory and calculate path to .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env}"

echo "=========================================="
echo "Upload Cross-Border Data Transfers Doc"
echo "=========================================="
echo ""

# Load credentials from .env file
if [ -f "$ENV_FILE" ]; then
    echo "Loading credentials from .env file..."
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            export "$line" 2>/dev/null || true
        fi
    done < "$ENV_FILE"
    set +a
    echo "✅ Loaded .env file"
fi

# Get credentials
if [ -z "$CONFLUENCE_EMAIL" ]; then
    read -p "Enter your Confluence email: " CONFLUENCE_EMAIL
fi

if [ -z "$CONFLUENCE_API_TOKEN" ]; then
    echo ""
    echo "To get your API token:"
    echo "1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens"
    echo "2. Click 'Create API token'"
    echo "3. Copy the token"
    echo ""
    read -sp "Enter your Confluence API token: " CONFLUENCE_API_TOKEN
    echo ""
fi

echo "Testing connection to Confluence..."
RESPONSE=$(curl -s --max-time 15 -w "\n%{http_code}" \
    -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "$CONFLUENCE_URL/wiki/rest/api/space/$SPACE_KEY" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Error connecting to Confluence (HTTP $HTTP_CODE)"
    exit 1
fi

echo "✅ Connected to Confluence!"
echo ""

# Function to get or create parent page
get_or_create_parent() {
    local category_title="$1"
    
    # Try to find existing page - search all pages in space
    echo "Searching for existing parent page..." >&2
    RESPONSE=$(curl -s --max-time 10 -w "\n%{http_code}" \
        -X GET \
        -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
        -H "Content-Type: application/json" \
        "$CONFLUENCE_URL/wiki/rest/api/content?spaceKey=$SPACE_KEY&limit=100" 2>/dev/null)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        PAGE_ID=$(echo "$BODY" | jq -r --arg title "$category_title" '.results[]? | select(.title == $title) | .id' 2>/dev/null | head -1)
        if [ -n "$PAGE_ID" ] && [ "$PAGE_ID" != "null" ]; then
            echo "Found existing parent page: $PAGE_ID" >&2
            echo "$PAGE_ID"
            return 0
        fi
    fi
    
    # Create if not found
    echo "Creating parent page: $category_title" >&2
    json_payload=$(jq -n \
        --arg title "$category_title" \
        --arg space "$SPACE_KEY" \
        '{
            type: "page",
            title: $title,
            space: { key: $space },
            body: {
                storage: {
                    value: "<p>This page contains legal and privacy documentation.</p>",
                    representation: "storage"
                }
            }
        }')
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        "$CONFLUENCE_URL/wiki/rest/api/content" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        PAGE_ID=$(echo "$BODY" | jq -r '.id' 2>/dev/null)
        if [ -n "$PAGE_ID" ] && [ "$PAGE_ID" != "null" ]; then
            echo "Created parent page: $PAGE_ID" >&2
            echo "$PAGE_ID"
            return 0
        fi
    fi
    
    echo "Error: Failed to create parent page (HTTP $HTTP_CODE)" >&2
    echo "Response: $BODY" >&2
    # If parent creation fails, try without parent (root level)
    echo "Attempting to create page without parent..." >&2
    echo ""
    return 1
}

# Function to convert markdown to Confluence storage format
convert_markdown_to_confluence() {
    local markdown="$1"
    echo "$markdown" | sed -E 's/^# (.*)$/h1. \1/' | \
    sed -E 's/^## (.*)$/h2. \1/' | \
    sed -E 's/^### (.*)$/h3. \1/' | \
    sed -E 's/^#### (.*)$/h4. \1/' | \
    sed -E 's/^```([a-z]*)?$/\{code\}/' | \
    sed -E 's/^```$/\{code\}/' | \
    sed -E 's/`([^`]+)`/{{ \1 }}/g' | \
    sed -E 's/\*\*([^\*]+)\*\*/*\1*/g' | \
    sed -E 's/\[([^\]]+)\]\(([^\)]+)\)/[\1|\2]/g'
}

# Get or create parent page
echo "Getting or creating parent page: $PARENT_CATEGORY"
PARENT_ID=$(get_or_create_parent "$PARENT_CATEGORY")

if [ -z "$PARENT_ID" ] || [[ ! "$PARENT_ID" =~ ^[0-9]+$ ]]; then
    echo "⚠️  Could not get/create parent page, creating at root level"
    PARENT_ID=""
else
    echo "✅ Parent page ID: $PARENT_ID"
fi
echo ""

# Read and convert content
echo "Reading document: $DOC_FILE"
CONTENT=$(cat "$DOC_FILE")
CONFLUENCE_CONTENT=$(convert_markdown_to_confluence "$CONTENT")

# Create page
TITLE="Cross-Border Data Transfers - PIPEDA Compliance"
echo "Creating page: $TITLE"

if [ -n "$PARENT_ID" ] && [[ "$PARENT_ID" =~ ^[0-9]+$ ]]; then
    json_payload=$(jq -n \
        --arg title "$TITLE" \
        --arg content "$CONFLUENCE_CONTENT" \
        --arg space "$SPACE_KEY" \
        --arg parent "$PARENT_ID" \
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
else
    json_payload=$(jq -n \
        --arg title "$TITLE" \
        --arg content "$CONFLUENCE_CONTENT" \
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
    PAGE_ID=$(echo "$BODY" | jq -r '.id' 2>/dev/null)
    if [ -n "$PAGE_ID" ] && [ "$PAGE_ID" != "null" ]; then
        echo "✅ Successfully created page!"
        echo "   Page ID: $PAGE_ID"
        echo "   URL: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY/pages/$PAGE_ID"
        exit 0
    fi
fi

echo "❌ Failed to create page (HTTP $HTTP_CODE)"
echo "Response: $BODY"
exit 1
