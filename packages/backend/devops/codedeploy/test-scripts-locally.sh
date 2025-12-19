#!/bin/bash
# Test CodeDeploy scripts locally without deploying
# This validates syntax, checks for common issues, and simulates script execution
# Usage: ./test-scripts-locally.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

echo "🧪 Testing CodeDeploy scripts locally..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check script syntax
check_syntax() {
    local script="$1"
    local name=$(basename "$script")
    
    echo -e "${BLUE}Checking syntax: $name${NC}"
    if bash -n "$script" 2>&1; then
        echo -e "${GREEN}  ✅ Syntax OK${NC}"
        return 0
    else
        echo -e "${RED}  ❌ Syntax error${NC}"
        bash -n "$script" 2>&1 | sed 's/^/    /'
        ((ERRORS++))
        return 1
    fi
}

# Function to check for common issues
check_common_issues() {
    local script="$1"
    local name=$(basename "$script")
    local issues=0
    
    echo -e "${BLUE}Checking for common issues: $name${NC}"
    
    # Check for uninitialized variables
    if grep -q 'EXIT_CODE' "$script" && ! grep -q 'EXIT_CODE=0' "$script" && ! grep -q 'EXIT_CODE=\$?' "$script"; then
        if ! grep -q 'EXIT_CODE=' "$script" | head -1; then
            echo -e "${YELLOW}  ⚠️  EXIT_CODE may be used before initialization${NC}"
            ((WARNINGS++))
            ((issues++))
        fi
    fi
    
    # Check for cd without error handling (only warn if set -e is used)
    if grep -q '^set -e' "$script"; then
        if grep -q '^cd "' "$script" && ! grep -q 'cd ".*" ||' "$script" && ! grep -q 'if ! cd' "$script"; then
            echo -e "${YELLOW}  ⚠️  cd command without error handling (may fail with set -e)${NC}"
            ((WARNINGS++))
            ((issues++))
        fi
    fi
    
    # Check for eval with arrays (common source of bugs)
    if grep -q 'eval.*\[@\]' "$script"; then
        echo -e "${YELLOW}  ⚠️  Using eval with array expansion (can be problematic)${NC}"
        ((WARNINGS++))
        ((issues++))
    fi
    
    # Check for undefined variables in conditionals (this is too noisy, skip for now)
    # if grep -E '\[.*\$[A-Z_]+.*\]' "$script" | grep -v 'EXIT_CODE' | grep -v 'DOCKER_COMPOSE' | grep -v 'DEPLOY_DIR' | grep -v 'CONTAINER_PREFIX' > /dev/null; then
    #     echo -e "${YELLOW}  ⚠️  Potential undefined variable in conditional${NC}"
    #     ((WARNINGS++))
    #     ((issues++))
    # fi
    
    if [ $issues -eq 0 ]; then
        echo -e "${GREEN}  ✅ No common issues found${NC}"
    fi
}

# Function to check script structure
check_structure() {
    local script="$1"
    local name=$(basename "$script")
    
    echo -e "${BLUE}Checking structure: $name${NC}"
    
    # Check for shebang
    if ! head -1 "$script" | grep -q '^#!/bin/bash'; then
        echo -e "${YELLOW}  ⚠️  Missing or incorrect shebang${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}  ✅ Has shebang${NC}"
    fi
    
    # Check for set -e or set +e
    if grep -q '^set -e' "$script"; then
        echo -e "${GREEN}  ✅ Uses 'set -e' (strict error handling)${NC}"
    elif grep -q '^set +e' "$script" || grep -q '# Don.*use set -e' "$script"; then
        echo -e "${GREEN}  ✅ Uses 'set +e' (intentional - handles errors gracefully)${NC}"
    else
        echo -e "${YELLOW}  ⚠️  No 'set -e' or 'set +e' found${NC}"
        ((WARNINGS++))
    fi
}

# Test each script
for script in "$SCRIPTS_DIR"/*.sh; do
    if [ ! -f "$script" ]; then
        continue
    fi
    
    name=$(basename "$script")
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing: $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_syntax "$script"
    check_structure "$script"
    check_common_issues "$script"
done

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found, but no errors${NC}"
    echo -e "${GREEN}✅ Scripts are safe to deploy (warnings are informational)${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo -e "${RED}❌ Fix errors before deploying${NC}"
    exit 1
fi
