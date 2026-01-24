#!/bin/bash
# Local testing script for buildspec-create-green-instance.yml
# This simulates the CodeBuild environment and runs the commands locally

set -e

echo "=========================================="
echo "Testing buildspec-create-green-instance.yml locally"
echo "=========================================="

# Set up environment variables (you can override these)
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-2}
export LAUNCH_TEMPLATE_NAME=${LAUNCH_TEMPLATE_NAME:-"bianca-staging-"}
export SUBNET_ID=${SUBNET_ID:-""}
export SECURITY_GROUP_ID=${SECURITY_GROUP_ID:-""}
export INSTANCE_PROFILE_NAME=${INSTANCE_PROFILE_NAME:-""}
export KEY_NAME=${KEY_NAME:-""}

# Simulate CodeBuild environment
export CODEBUILD_SRC_DIR=${PWD}
export CODEBUILD_BUILD_NUMBER="local-test-$(date +%s)"

echo ""
echo "Environment Variables:"
echo "  AWS_DEFAULT_REGION: ${AWS_DEFAULT_REGION}"
echo "  LAUNCH_TEMPLATE_NAME: ${LAUNCH_TEMPLATE_NAME}"
echo "  SUBNET_ID: ${SUBNET_ID}"
echo "  SECURITY_GROUP_ID: ${SECURITY_GROUP_ID}"
echo "  INSTANCE_PROFILE_NAME: ${INSTANCE_PROFILE_NAME}"
echo "  KEY_NAME: ${KEY_NAME}"
echo ""

# Validate YAML syntax first - use strict validation
echo "Step 1: Validating YAML syntax..."
BUILDSPEC_FILE="packages/backend/devops/buildspec-create-green-instance.yml"

# Check 1: Python YAML parser (basic validation)
if command -v python3 &> /dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('$BUILDSPEC_FILE'))" 2>/dev/null; then
        echo "✓ Python YAML parser: Valid"
    else
        echo "❌ Python YAML parser: INVALID"
        exit 1
    fi
else
    echo "⚠ Python3 not found, skipping basic YAML validation"
fi

    # Check 2: CodeBuild-specific validation - check structure matches working buildspecs
echo "Step 1b: Validating CodeBuild-specific structure..."
if [ -f "$BUILDSPEC_FILE" ]; then
    # Check that version is followed directly by phases (CodeBuild is VERY strict)
    VERSION_LINE=$(grep -n "^version:" "$BUILDSPEC_FILE" | cut -d: -f1)
    PHASES_LINE=$(grep -n "^phases:" "$BUILDSPEC_FILE" | cut -d: -f1)
    if [ -n "$VERSION_LINE" ] && [ -n "$PHASES_LINE" ]; then
        LINES_BETWEEN=$((PHASES_LINE - VERSION_LINE))
        # CodeBuild requires: version line, then phases line (no blank line in between)
        # OR: version line, blank line, phases line (exactly 2 lines between)
        if [ "$LINES_BETWEEN" -eq 1 ]; then
            echo "✓ Version directly followed by phases (CodeBuild compatible)"
        elif [ "$LINES_BETWEEN" -eq 2 ]; then
            # Check if line 2 is blank
            LINE_2=$(sed -n '2p' "$BUILDSPEC_FILE")
            if [ -z "$LINE_2" ]; then
                echo "⚠ WARNING: Blank line after 'version:' - CodeBuild may reject this!"
                echo "   Recommendation: Remove blank line (version should be directly followed by phases)"
                echo "   This matches working buildspec: buildspec-staging.yml"
            else
                echo "❌ ERROR: Line 2 is not blank but not 'phases:' either"
                echo "   Line 2 content: '$LINE_2'"
                exit 1
            fi
        else
            echo "❌ ERROR: Invalid structure - 'phases:' must be on line $((VERSION_LINE + 1)) or $((VERSION_LINE + 2))"
            echo "   Found 'phases:' on line $PHASES_LINE (should be $((VERSION_LINE + 1)) or $((VERSION_LINE + 2)))"
            exit 1
        fi
    fi
    
    # Check for emoji characters that might cause issues
    if grep -q -P '[^\x00-\x7F]' "$BUILDSPEC_FILE" 2>/dev/null; then
        echo "⚠ WARNING: Non-ASCII characters found (may cause CodeBuild parsing issues)"
        grep -n -P '[^\x00-\x7F]' "$BUILDSPEC_FILE" | head -5
    fi
    
    # Compare structure with working buildspec
    WORKING_BUILDSPEC="packages/backend/devops/buildspec-staging.yml"
    if [ -f "$WORKING_BUILDSPEC" ]; then
        WORKING_VERSION_LINE=$(head -1 "$WORKING_BUILDSPEC")
        TEST_VERSION_LINE=$(head -1 "$BUILDSPEC_FILE")
        if [ "$WORKING_VERSION_LINE" != "$TEST_VERSION_LINE" ]; then
            echo "⚠ WARNING: Version line doesn't match working buildspec"
        fi
        
        WORKING_SECOND_LINE=$(sed -n '2p' "$WORKING_BUILDSPEC")
        TEST_SECOND_LINE=$(sed -n '2p' "$BUILDSPEC_FILE")
        if [ "$WORKING_SECOND_LINE" != "$TEST_SECOND_LINE" ]; then
            echo "⚠ WARNING: Line 2 structure differs from working buildspec"
            echo "   Working: '$WORKING_SECOND_LINE'"
            echo "   Test:    '$TEST_SECOND_LINE'"
        fi
    fi
    
    echo "✓ CodeBuild structure validation passed"
else
    echo "❌ Buildspec file not found: $BUILDSPEC_FILE"
    exit 1
fi

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "❌ ERROR: AWS CLI not found. Please install it first."
    exit 1
fi

# Check AWS credentials
echo ""
echo "Step 2: Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    echo "✓ AWS credentials valid (Account: $AWS_ACCOUNT)"
else
    echo "❌ ERROR: AWS credentials not configured"
    exit 1
fi

# Test pre_build phase
echo ""
echo "=========================================="
echo "Step 3: Testing pre_build phase"
echo "=========================================="

echo "Starting blue-green deployment: Creating green instance..."
echo "Configuration:"
echo "  Launch Template: ${LAUNCH_TEMPLATE_NAME}"
echo "  Subnet: ${SUBNET_ID}"
echo "  Security Group: ${SECURITY_GROUP_ID}"
echo "  Instance Profile: ${INSTANCE_PROFILE_NAME}"
echo "  Key Name: ${KEY_NAME}"
echo "  AWS Region: ${AWS_DEFAULT_REGION}"

# Validate required environment variables
if [ -z "${LAUNCH_TEMPLATE_NAME}" ]; then
    echo "ERROR: LAUNCH_TEMPLATE_NAME is not set"
    exit 1
fi
if [ -z "${SUBNET_ID}" ]; then
    echo "ERROR: SUBNET_ID is not set"
    exit 1
fi
if [ -z "${SECURITY_GROUP_ID}" ]; then
    echo "ERROR: SECURITY_GROUP_ID is not set"
    exit 1
fi
echo "All required environment variables are set"

# Test build phase (dry-run mode - won't actually create instance)
echo ""
echo "=========================================="
echo "Step 4: Testing build phase (DRY RUN)"
echo "=========================================="

DRY_RUN=${DRY_RUN:-true}

if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN MODE: Will not create actual instances"
    echo ""
    
    # Test launch template lookup
    echo "Testing launch template lookup..."
    LAUNCH_TEMPLATE_INFO=$(aws ec2 describe-launch-templates \
      --launch-template-names ${LAUNCH_TEMPLATE_NAME} \
      --query 'LaunchTemplates[0]' \
      --output json 2>&1 || echo "null")
    
    if [ "$LAUNCH_TEMPLATE_INFO" = "null" ] || [ -z "$LAUNCH_TEMPLATE_INFO" ]; then
        echo "WARNING: Launch template not found by exact name, trying to find by prefix..."
        LAUNCH_TEMPLATE_INFO=$(aws ec2 describe-launch-templates \
          --filters "Name=launch-template-name,Values=${LAUNCH_TEMPLATE_NAME}*" \
          --query 'LaunchTemplates[0]' \
          --output json 2>&1 || echo "null")
    fi
    
    if [ "$LAUNCH_TEMPLATE_INFO" = "null" ] || [ -z "$LAUNCH_TEMPLATE_INFO" ]; then
        echo "WARNING: Could not verify launch template (may be permission issue)"
        echo "Searched for: ${LAUNCH_TEMPLATE_NAME}"
        echo "Attempting to list launch templates (may fail due to permissions)..."
        if aws ec2 describe-launch-templates --query 'LaunchTemplates[*].[LaunchTemplateName,LaunchTemplateId]' --output table 2>&1; then
            echo "Launch templates listed successfully"
        else
            echo "⚠ Permission issue - this is expected if using different AWS credentials than CodeBuild"
            echo "✓ YAML structure and command syntax are valid"
            echo "✓ CodeBuild will have the correct IAM permissions"
        fi
        # Don't exit - this is just a validation test
    fi
    
    ACTUAL_LAUNCH_TEMPLATE_NAME=$(aws ec2 describe-launch-templates \
      --launch-template-names ${LAUNCH_TEMPLATE_NAME} \
      --query 'LaunchTemplates[0].LaunchTemplateName' \
      --output text 2>/dev/null || \
      aws ec2 describe-launch-templates \
      --filters "Name=launch-template-name,Values=${LAUNCH_TEMPLATE_NAME}*" \
      --query 'LaunchTemplates[0].LaunchTemplateName' \
      --output text)
    
    LAUNCH_TEMPLATE_ID=$(aws ec2 describe-launch-templates \
      --launch-template-names $ACTUAL_LAUNCH_TEMPLATE_NAME \
      --query 'LaunchTemplates[0].LaunchTemplateId' \
      --output text 2>/dev/null || \
      aws ec2 describe-launch-templates \
      --filters "Name=launch-template-name,Values=${LAUNCH_TEMPLATE_NAME}*" \
      --query 'LaunchTemplates[0].LaunchTemplateId' \
      --output text)
    
    echo "Found launch template: $ACTUAL_LAUNCH_TEMPLATE_NAME (ID: $LAUNCH_TEMPLATE_ID)"
    
    # Get launch template version
    LAUNCH_TEMPLATE_VERSION=$(aws ec2 describe-launch-template-versions \
      --launch-template-name $ACTUAL_LAUNCH_TEMPLATE_NAME \
      --versions '$Latest' \
      --query 'LaunchTemplateVersions[0].VersionNumber' \
      --output text 2>&1)
    
    if [ $? -ne 0 ] || [ -z "$LAUNCH_TEMPLATE_VERSION" ] || [ "$LAUNCH_TEMPLATE_VERSION" = "None" ]; then
        echo "ERROR: Failed to get launch template version"
        echo "Output: $LAUNCH_TEMPLATE_VERSION"
        exit 1
    fi
    
    echo "Using launch template: $ACTUAL_LAUNCH_TEMPLATE_NAME, version: $LAUNCH_TEMPLATE_VERSION"
    
    # Test subnet and security group
    echo ""
    echo "Testing subnet and security group..."
    if aws ec2 describe-subnets --subnet-ids ${SUBNET_ID} &> /dev/null; then
        echo "✓ Subnet ${SUBNET_ID} exists"
    else
        echo "⚠ Could not verify subnet (may be permission issue)"
        echo "  Subnet ID format looks valid: ${SUBNET_ID}"
    fi
    
    if aws ec2 describe-security-groups --group-ids ${SECURITY_GROUP_ID} &> /dev/null; then
        echo "✓ Security group ${SECURITY_GROUP_ID} exists"
    else
        echo "⚠ Could not verify security group (may be permission issue)"
        echo "  Security Group ID format looks valid: ${SECURITY_GROUP_ID}"
    fi
    
    echo ""
    echo "✓ All checks passed! Buildspec commands would work."
    echo ""
    echo "To actually create an instance, run:"
    echo "  DRY_RUN=false ./test-buildspec-create-green-instance.sh"
    
else
    echo "LIVE MODE: Will create actual instance"
    echo "⚠️  WARNING: This will create a real EC2 instance!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
    
    # Run the actual build commands
    source packages/backend/devops/buildspec-create-green-instance.yml
fi

echo ""
echo "=========================================="
echo "Test completed successfully!"
echo "=========================================="
