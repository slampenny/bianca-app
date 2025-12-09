#!/bin/bash
# Script to import all remaining documentation to Confluence

set -e

CONFLUENCE_URL="${CONFLUENCE_URL:-https://biancatechnologies.atlassian.net}"
SPACE_KEY="${SPACE_KEY:-BTD}"
DOCS_DIR="bianca-app-backend/docs"

echo "=========================================="
echo "Complete Documentation Importer"
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

# Function to create a page in Confluence
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

# Function to get or create parent page
get_or_create_parent() {
    local category_title="$1"
    
    # Search for existing page
    RESPONSE=$(curl -s --max-time 10 -w "\n%{http_code}" \
        -X GET \
        -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
        -H "Content-Type: application/json" \
        "$CONFLUENCE_URL/wiki/rest/api/content?spaceKey=$SPACE_KEY&limit=100" 2>/dev/null)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        PAGE_ID=$(echo "$BODY" | jq -r --arg title "$category_title" '.results[]? | select(.title == $title) | .id' 2>/dev/null | head -1)
        if [ -n "$PAGE_ID" ] && [[ "$PAGE_ID" =~ ^[0-9]+$ ]]; then
            echo "$PAGE_ID" >&1
            return 0
        fi
    fi
    
    # Create new page
    echo "Creating parent page: $category_title" >&2
    PARENT_OUTPUT=$(create_page "$category_title" "Category: $category_title" 2>&1)
    PARENT_ID=$(echo "$PARENT_OUTPUT" | grep -E '^[0-9]+$' | tail -1)
    
    if [ -n "$PARENT_ID" ] && [[ "$PARENT_ID" =~ ^[0-9]+$ ]]; then
        echo "$PARENT_ID" >&1
        return 0
    else
        if [[ "$PARENT_OUTPUT" == *"already exists"* ]]; then
            sleep 1
            RESPONSE=$(curl -s --max-time 10 -w "\n%{http_code}" \
                -X GET \
                -u "$CONFLUENCE_EMAIL:$CONFLUENCE_API_TOKEN" \
                -H "Content-Type: application/json" \
                "$CONFLUENCE_URL/wiki/rest/api/content?spaceKey=$SPACE_KEY&limit=100" 2>/dev/null)
            HTTP_CODE=$(echo "$RESPONSE" | tail -1)
            BODY=$(echo "$RESPONSE" | sed '$d')
            if [ "$HTTP_CODE" = "200" ]; then
                PAGE_ID=$(echo "$BODY" | jq -r --arg title "$category_title" '.results[]? | select(.title == $title) | .id' 2>/dev/null | head -1)
                if [ -n "$PAGE_ID" ] && [[ "$PAGE_ID" =~ ^[0-9]+$ ]]; then
                    echo "$PAGE_ID" >&1
                    return 0
                fi
            fi
        fi
        echo "Error: Failed to create parent page" >&2
        return 1
    fi
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

# Category mapping
declare -A CATEGORY_MAP
CATEGORY_MAP["hipaa"]="🔒 HIPAA Compliance"
CATEGORY_MAP["legal"]="📜 Legal & Privacy"
CATEGORY_MAP["deployment"]="🚀 Deployment"
CATEGORY_MAP["technical"]="⚙️ Technical Documentation"
CATEGORY_MAP["testing"]="🧪 Testing"
CATEGORY_MAP["organization"]="📋 Organization"
CATEGORY_MAP["ai-system"]="🤖 AI & Machine Learning"
CATEGORY_MAP["root"]="📚 General Documentation"

echo "Starting comprehensive documentation import..."
echo ""

IMPORTED=0
SKIPPED=0
FAILED=0

# Process all markdown files
find "$DOCS_DIR" -name "*.md" -type f | sort | while read filepath; do
    # Get relative path from docs directory
    rel_path=${filepath#$DOCS_DIR/}
    
    # Determine category from directory structure
    if [[ "$rel_path" == hipaa/* ]]; then
        category="hipaa"
        sub_path=${rel_path#hipaa/}
    elif [[ "$rel_path" == legal/* ]]; then
        category="legal"
        sub_path=${rel_path#legal/}
    elif [[ "$rel_path" == deployment/* ]]; then
        category="deployment"
        sub_path=${rel_path#deployment/}
    elif [[ "$rel_path" == technical/* ]]; then
        category="technical"
        sub_path=${rel_path#technical/}
    elif [[ "$rel_path" == testing/* ]]; then
        category="testing"
        sub_path=${rel_path#testing/}
    elif [[ "$rel_path" == organization/* ]]; then
        category="organization"
        sub_path=${rel_path#organization/}
    elif [[ "$rel_path" == ai-system/* ]]; then
        category="ai-system"
        sub_path=${rel_path#ai-system/}
    else
        category="root"
        sub_path="$rel_path"
    fi
    
    if [ -z "$category" ]; then
        category="root"
    fi
    category_title="${CATEGORY_MAP[$category]}"
    
    # Create title from file path
    TITLE=$(echo "$sub_path" | sed 's|/| / |g' | sed 's/_/ /g' | sed 's|\.md$||' | sed 's/\b\(.\)/\u\1/g')
    
    echo "Processing: $rel_path -> $category_title"
    
    # Get or create parent page
    if [ -n "$category" ] && [ "$category" != "root" ]; then
        PARENT_ID=$(get_or_create_parent "$category_title")
        
        if [ -z "$PARENT_ID" ] || [[ ! "$PARENT_ID" =~ ^[0-9]+$ ]]; then
            echo "  ⚠️  Skipping (failed to get/create parent page)"
            FAILED=$((FAILED + 1))
            continue
        fi
    else
        PARENT_ID=""
    fi
    
    # Read and convert content
    CONTENT=$(cat "$filepath")
    CONFLUENCE_CONTENT=$(convert_markdown_to_confluence "$CONTENT")
    
    # Create page
    PAGE_ID=$(create_page "$TITLE" "$CONFLUENCE_CONTENT" "$PARENT_ID" 2>&1 | tail -1)
    
    if [ -n "$PAGE_ID" ] && [ "$PAGE_ID" != "null" ] && [[ "$PAGE_ID" =~ ^[0-9]+$ ]]; then
        echo "  ✅ Created: $TITLE (ID: $PAGE_ID)"
        IMPORTED=$((IMPORTED + 1))
    else
        if [[ "$PAGE_ID" == *"already exists"* ]] || [[ "$PAGE_ID" == *"400"* ]]; then
            echo "  ⚠️  Skipped: $TITLE (already exists)"
            SKIPPED=$((SKIPPED + 1))
        else
            echo "  ❌ Failed: $TITLE"
            FAILED=$((FAILED + 1))
        fi
    fi
    
    sleep 1
done

echo ""
echo "✅ Documentation import complete!"
echo ""
echo "  Imported: $IMPORTED"
echo "  Skipped: $SKIPPED (already exist)"
echo "  Failed: $FAILED"
echo ""
echo "Check your Confluence space: $CONFLUENCE_URL/wiki/spaces/$SPACE_KEY"

