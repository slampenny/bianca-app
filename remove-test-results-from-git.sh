#!/bin/bash
# Script to remove test result files from git tracking

cd "$(dirname "$0")"

echo "Removing test result files from git tracking..."

# Remove test-results directories
if git ls-files | grep -q "test-results"; then
  echo "Removing test-results/ directories..."
  git rm -r --cached test-results/ 2>/dev/null || true
  git rm -r --cached **/test-results/ 2>/dev/null || true
fi

# Remove playwright-report directories
if git ls-files | grep -q "playwright-report"; then
  echo "Removing playwright-report/ directories..."
  git rm -r --cached playwright-report/ 2>/dev/null || true
  git rm -r --cached **/playwright-report/ 2>/dev/null || true
fi

# Remove .playwright cache directories
if git ls-files | grep -q ".playwright"; then
  echo "Removing .playwright/ directories..."
  git rm -r --cached .playwright/ 2>/dev/null || true
  git rm -r --cached **/.playwright/ 2>/dev/null || true
fi

# Remove test console log files
if git ls-files test/ | grep -q "test-console-"; then
  echo "Removing test-console-*.txt files..."
  git rm --cached test/test-console-*.txt 2>/dev/null || true
  git rm --cached **/test-console-*.txt 2>/dev/null || true
fi

# Remove video files (.webm, .mp4)
if git ls-files | grep -qE "\.(webm|mp4)$"; then
  echo "Removing .webm and .mp4 files..."
  git ls-files | grep -E "\.(webm|mp4)$" | xargs -r git rm --cached 2>/dev/null || true
fi

# Remove trace files
if git ls-files | grep -qE "\.trace$"; then
  echo "Removing .trace files..."
  git ls-files | grep -E "\.trace$" | xargs -r git rm --cached 2>/dev/null || true
fi

echo "Done! Review the changes with 'git status' and commit when ready."
echo "Note: Files are removed from git but kept locally."
