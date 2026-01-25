#!/bin/bash
# Strict buildspec validator that mimics CodeBuild's parser behavior
# This catches issues that Python's yaml.safe_load() misses

set -e

BUILDSPEC_FILE="${1:-packages/backend/devops/buildspec-create-green-instance.yml}"

echo "=========================================="
echo "Strict Buildspec Validator"
echo "File: $BUILDSPEC_FILE"
echo "=========================================="
echo ""

# Check 1: File exists
if [ ! -f "$BUILDSPEC_FILE" ]; then
    echo "❌ ERROR: Buildspec file not found: $BUILDSPEC_FILE"
    exit 1
fi

# Check 2: No tabs (CodeBuild requires spaces)
if grep -q $'\t' "$BUILDSPEC_FILE"; then
    echo "❌ ERROR: Tabs found in buildspec (CodeBuild requires spaces)"
    grep -n $'\t' "$BUILDSPEC_FILE" | head -5
    exit 1
fi
echo "✓ No tabs found"

# Check 3: Line endings (should be Unix)
if file "$BUILDSPEC_FILE" | grep -q "CRLF"; then
    echo "❌ ERROR: Windows line endings (CRLF) found - CodeBuild requires Unix (LF)"
    exit 1
fi
echo "✓ Unix line endings (LF)"

# Check 4: Structure - version must be on line 1
FIRST_LINE=$(head -1 "$BUILDSPEC_FILE")
if [[ ! "$FIRST_LINE" =~ ^version: ]]; then
    echo "❌ ERROR: First line must be 'version: 0.2'"
    echo "   Found: '$FIRST_LINE'"
    exit 1
fi
echo "✓ Version line correct"

# Check 5: phases must follow version (with 0-1 blank lines)
VERSION_LINE=$(grep -n "^version:" "$BUILDSPEC_FILE" | cut -d: -f1)
PHASES_LINE=$(grep -n "^phases:" "$BUILDSPEC_FILE" | cut -d: -f1)
if [ -z "$PHASES_LINE" ]; then
    echo "❌ ERROR: 'phases:' not found"
    exit 1
fi

LINES_BETWEEN=$((PHASES_LINE - VERSION_LINE))
if [ "$LINES_BETWEEN" -lt 1 ] || [ "$LINES_BETWEEN" -gt 2 ]; then
    echo "❌ ERROR: 'phases:' must be 1-2 lines after 'version:'"
    echo "   Found $LINES_BETWEEN lines between"
    exit 1
fi
echo "✓ Phases structure correct"

# Check 6: Commands array - first command must be a string (not dict)
# CodeBuild error: "Expected Commands[0] to be of string type: found subkeys instead"
PRE_BUILD_START=$(grep -n "pre_build:" "$BUILDSPEC_FILE" | cut -d: -f1)
COMMANDS_START=$(awk -v start="$PRE_BUILD_START" 'NR > start && /^[ ]*commands:/ {print NR; exit}' "$BUILDSPEC_FILE")
FIRST_CMD_LINE=$((COMMANDS_START + 1))

if [ -n "$FIRST_CMD_LINE" ]; then
    FIRST_CMD=$(sed -n "${FIRST_CMD_LINE}p" "$BUILDSPEC_FILE")
    
    # Check if first command starts with '-' and is a simple string (not '|')
    if [[ "$FIRST_CMD" =~ ^[[:space:]]*-[[:space:]]+echo ]]; then
        # Check for colons in the echo string that might be parsed as key-value
        if echo "$FIRST_CMD" | grep -q 'echo.*:.*"'; then
            echo "⚠ WARNING: Colon in echo string may cause CodeBuild parser issues"
            echo "   Line $FIRST_CMD_LINE: $FIRST_CMD"
            echo "   CodeBuild may parse colons as YAML key-value separators"
        fi
        
        # Check if it's a dict (has unquoted colon followed by space)
        if echo "$FIRST_CMD" | grep -qE 'echo[^"]*:[^"]*[^"]'; then
            echo "❌ ERROR: First command may be parsed as dict instead of string"
            echo "   Line $FIRST_CMD_LINE: $FIRST_CMD"
            echo "   Remove colons from echo strings or quote properly"
            exit 1
        fi
    fi
    echo "✓ First command structure looks correct"
fi

# Check 7: Python YAML validation
echo ""
echo "Step 7: Python YAML validation..."
if python3 -c "import yaml; yaml.safe_load(open('$BUILDSPEC_FILE'))" 2>/dev/null; then
    echo "✓ Python YAML parser: Valid"
    
    # Additional check - verify commands are strings, not dicts
    python3 << EOF
import yaml
import sys

with open('$BUILDSPEC_FILE', 'r') as f:
    data = yaml.safe_load(f)
    
phases = data.get('phases', {})
for phase_name, phase_data in phases.items():
    commands = phase_data.get('commands', [])
    for i, cmd in enumerate(commands):
        if not isinstance(cmd, str):
            print(f"❌ ERROR: {phase_name}.commands[{i}] is {type(cmd).__name__}, not string")
            print(f"   Value: {cmd}")
            sys.exit(1)
        # Check for problematic patterns
        if ':' in cmd and not (cmd.startswith('echo') and '"' in cmd):
            # Colon outside quoted echo might be problematic
            pass

print("✓ All commands are strings")
EOF
else
    echo "❌ Python YAML parser: Invalid"
    exit 1
fi

# Check 8: Compare with working buildspec structure
WORKING_BUILDSPEC="packages/backend/devops/buildspec-staging.yml"
if [ -f "$WORKING_BUILDSPEC" ]; then
    echo ""
    echo "Step 8: Comparing structure with working buildspec..."
    
    # Compare first 5 lines
    DIFF=$(diff -u <(head -5 "$WORKING_BUILDSPEC") <(head -5 "$BUILDSPEC_FILE") 2>&1)
    if [ $? -eq 0 ]; then
        echo "✓ First 5 lines match working buildspec exactly"
    else
        echo "⚠ First 5 lines differ (may be okay):"
        echo "$DIFF" | head -10
    fi
fi

echo ""
echo "=========================================="
echo "✓ All validation checks passed!"
echo "=========================================="
echo ""
echo "The buildspec structure is valid."
echo "Note: This validates structure only - actual command execution"
echo "      may still fail due to AWS permissions or resource issues."
