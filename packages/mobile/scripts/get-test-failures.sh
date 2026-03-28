#!/bin/bash
# Quick script to get just the test failures from the latest run
# Usage: ./scripts/get-test-failures.sh

set -e

AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-us-east-2}"
S3_BUCKET="bianca-codedeploy-artifacts-$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Checking latest test failures...${NC}"
echo ""

# Get latest build
LATEST_INFO=$(aws s3 cp "s3://${S3_BUCKET}/test-results/latest.json" - --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$LATEST_INFO" ]; then
  echo -e "${RED}❌ No test results found${NC}"
  exit 1
fi

BUILD_PREFIX=$(echo "$LATEST_INFO" | grep -o '"s3_prefix":"[^"]*"' | cut -d'"' -f4)
BUILD_NUMBER=$(echo "$LATEST_INFO" | grep -o '"build_number":"[^"]*"' | cut -d'"' -f4)
TIMESTAMP=$(echo "$LATEST_INFO" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)

echo -e "${BLUE}Build: ${BUILD_NUMBER} (${TIMESTAMP})${NC}"
echo ""

# Download just the JUnit XML and output log
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

aws s3 cp "s3://${S3_BUCKET}/test-results/${BUILD_PREFIX}/junit.xml" "$TMP_DIR/junit.xml" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --quiet 2>/dev/null || echo ""

aws s3 cp "s3://${S3_BUCKET}/test-results/${BUILD_PREFIX}/playwright-output.log" "$TMP_DIR/playwright-output.log" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --quiet 2>/dev/null || echo ""

# Parse JUnit XML for failures
if [ -f "$TMP_DIR/junit.xml" ]; then
  if command -v xmllint >/dev/null 2>&1; then
    FAILED_COUNT=$(xmllint --xpath "count(//testcase[failure or error])" "$TMP_DIR/junit.xml" 2>/dev/null || echo "0")
    TOTAL_COUNT=$(xmllint --xpath "count(//testcase)" "$TMP_DIR/junit.xml" 2>/dev/null || echo "0")
    
    if [ "$FAILED_COUNT" -gt 0 ]; then
      echo -e "${RED}❌ ${FAILED_COUNT} of ${TOTAL_COUNT} tests failed${NC}"
      echo ""
      echo -e "${RED}Failed tests:${NC}"
      xmllint --xpath "//testcase[failure or error]" "$TMP_DIR/junit.xml" 2>/dev/null | \
        grep -o 'name="[^"]*"' | sed 's/name="\([^"]*\)"/\1/' | while read -r test; do
          echo -e "  ${RED}❌${NC} $test"
        done
      echo ""
      
      # Show failure messages
      echo -e "${RED}Failure details:${NC}"
      xmllint --xpath "//testcase[failure or error]" "$TMP_DIR/junit.xml" 2>/dev/null | \
        grep -A 5 '<failure\|<error' | head -20
    else
      echo -e "${GREEN}✅ All ${TOTAL_COUNT} tests passed${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  xmllint not available, showing raw output...${NC}"
    if [ -f "$TMP_DIR/playwright-output.log" ]; then
      grep -i "failed\|error\|✖" "$TMP_DIR/playwright-output.log" | tail -20 || echo "No failures found in log"
    fi
  fi
elif [ -f "$TMP_DIR/playwright-output.log" ]; then
  echo -e "${YELLOW}JUnit XML not available, parsing log output...${NC}"
  echo ""
  grep -i "failed\|error\|✖" "$TMP_DIR/playwright-output.log" | tail -30 || echo "No failures found"
else
  echo -e "${YELLOW}⚠️  No test result files found${NC}"
fi

echo ""
echo -e "${BLUE}For full details, run:${NC}"
echo "  ./scripts/view-test-results.sh"
