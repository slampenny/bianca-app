#!/bin/bash
# Script to download and view Playwright test results from AWS S3
# Usage: ./scripts/view-test-results.sh [build-number]

set -e

AWS_PROFILE="${AWS_PROFILE:-jordan}"
AWS_REGION="${AWS_REGION:-us-east-2}"
PIPELINE_NAME="bianca-staging-pipeline"
S3_BUCKET="bianca-codedeploy-artifacts-$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📥 Downloading Playwright test results from AWS...${NC}"
echo ""

# Get the latest test results
if [ -n "$1" ]; then
  # Specific build number provided
  BUILD_NUMBER="$1"
  echo -e "${BLUE}Looking for build number: ${BUILD_NUMBER}${NC}"
  
  # Find the build with this number
  BUILD_PREFIX=$(aws s3 ls "s3://${S3_BUCKET}/test-results/" --profile "$AWS_PROFILE" --region "$AWS_REGION" | \
    grep "^.*PRE ${BUILD_NUMBER}-" | head -1 | awk '{print $2}' | sed 's/\///')
  
  if [ -z "$BUILD_PREFIX" ]; then
    echo -e "${RED}❌ Could not find test results for build number ${BUILD_NUMBER}${NC}"
    echo "Available builds:"
    aws s3 ls "s3://${S3_BUCKET}/test-results/" --profile "$AWS_PROFILE" --region "$AWS_REGION" | \
      grep "^.*PRE" | awk '{print "  - " $2}' | head -10
    exit 1
  fi
else
  # Get latest from latest.json marker
  echo -e "${BLUE}Finding latest test results...${NC}"
  LATEST_INFO=$(aws s3 cp "s3://${S3_BUCKET}/test-results/latest.json" - --profile "$AWS_PROFILE" --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [ -z "$LATEST_INFO" ]; then
    echo -e "${YELLOW}⚠️  No latest.json marker found, searching for most recent build...${NC}"
    # Find the most recent build by listing and sorting
    BUILD_PREFIX=$(aws s3 ls "s3://${S3_BUCKET}/test-results/" --profile "$AWS_PROFILE" --region "$AWS_REGION" | \
      grep "^.*PRE" | sort -r | head -1 | awk '{print $2}' | sed 's/\///')
    
    if [ -z "$BUILD_PREFIX" ]; then
      echo -e "${RED}❌ No test results found in S3${NC}"
      exit 1
    fi
  else
    BUILD_PREFIX=$(echo "$LATEST_INFO" | grep -o '"s3_prefix":"[^"]*"' | cut -d'"' -f4)
    BUILD_NUMBER=$(echo "$LATEST_INFO" | grep -o '"build_number":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ Found latest build: ${BUILD_NUMBER}${NC}"
  fi
fi

echo ""
echo -e "${BLUE}📦 Build: ${BUILD_PREFIX}${NC}"
echo ""

# Create local directory for test results
DOWNLOAD_DIR="./test-results-download"
mkdir -p "$DOWNLOAD_DIR"
cd "$DOWNLOAD_DIR"

# Download test results
echo -e "${BLUE}Downloading test results...${NC}"
aws s3 sync "s3://${S3_BUCKET}/test-results/${BUILD_PREFIX}/" . \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --quiet

echo -e "${GREEN}✅ Test results downloaded to: ${DOWNLOAD_DIR}${NC}"
echo ""

# Show summary
if [ -f "run-summary.txt" ]; then
  echo -e "${BLUE}=== Test Run Summary ===${NC}"
  cat run-summary.txt
  echo ""
fi

# Show test failures from JUnit XML if available
if [ -f "junit.xml" ]; then
  echo -e "${BLUE}=== Test Failures (from JUnit XML) ===${NC}"
  if command -v xmllint >/dev/null 2>&1; then
    FAILED_TESTS=$(xmllint --xpath "//testcase[@status='failed' or failure or error]/@name" junit.xml 2>/dev/null | \
      sed 's/name="\([^"]*\)"/\1\n/g' | grep -v '^$' || echo "")
    if [ -n "$FAILED_TESTS" ]; then
      echo -e "${RED}Failed tests:${NC}"
      echo "$FAILED_TESTS" | while read -r test; do
        echo -e "  ${RED}❌${NC} $test"
      done
    else
      echo -e "${GREEN}✅ No failed tests found in JUnit XML${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  xmllint not available, skipping JUnit XML parsing${NC}"
    echo "   Install libxml2-utils to parse JUnit XML"
  fi
  echo ""
fi

# Show Playwright output log
if [ -f "playwright-output.log" ]; then
  echo -e "${BLUE}=== Playwright Test Output (last 50 lines) ===${NC}"
  tail -50 playwright-output.log
  echo ""
fi

# Check for HTML report
if [ -d "playwright-report" ] && [ -f "playwright-report/index.html" ]; then
  echo -e "${GREEN}✅ HTML Report available!${NC}"
  echo ""
  echo -e "${BLUE}To view the HTML report:${NC}"
  echo "  1. Open: file://$(pwd)/playwright-report/index.html"
  echo "  2. Or run: open playwright-report/index.html"
  echo ""
  
  # Try to open automatically on macOS/Linux
  if command -v open >/dev/null 2>&1; then
    echo -e "${BLUE}Opening HTML report in browser...${NC}"
    open playwright-report/index.html
  elif command -v xdg-open >/dev/null 2>&1; then
    echo -e "${BLUE}Opening HTML report in browser...${NC}"
    xdg-open playwright-report/index.html
  fi
else
  echo -e "${YELLOW}⚠️  HTML report not found${NC}"
fi

# Show available files
echo ""
echo -e "${BLUE}=== Available Files ===${NC}"
ls -lh | grep -v "^total" | awk '{print "  " $9 " (" $5 ")"}'
echo ""

# Show S3 location
echo -e "${BLUE}S3 Location:${NC}"
echo "  s3://${S3_BUCKET}/test-results/${BUILD_PREFIX}/"
echo ""

# Show CloudWatch logs link
BUILD_ID=$(echo "$BUILD_PREFIX" | grep -o '[^/]*$' | cut -d'-' -f2- || echo "")
if [ -n "$BUILD_ID" ]; then
  echo -e "${BLUE}CloudWatch Logs:${NC}"
  LOG_GROUP="/aws/codebuild/bianca-staging-tests"
  echo "  https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups/log-group/${LOG_GROUP//\//$2F}"
  echo ""
fi

echo -e "${GREEN}✅ Done!${NC}"
