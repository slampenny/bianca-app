#!/bin/bash

# Script to fix duplicate colors declarations in all screen files
echo "🔧 Fixing duplicate colors declarations..."

# List of files that need fixing based on the grep results
FILES=(
  "app/screens/PaymentInfoScreen.tsx"
  "app/screens/RegisterScreen.tsx"
  "app/screens/SignupScreen.tsx"
  "app/screens/SentimentAnalysisScreen.tsx"
  "app/screens/ReportsScreen.tsx"
  "app/screens/LogoutScreen.tsx"
  "app/screens/EmailVerifiedScreen.tsx"
  "app/screens/EmailVerificationRequiredScreen.tsx"
)

# Function to fix duplicate declarations in a file
fix_duplicates() {
  local file="$1"
  echo "🔧 Fixing duplicates in $file..."
  
  # Create backup
  cp "$file" "$file.backup"
  
  # Remove duplicate lines that contain "const { colors, isLoading: themeLoading } = useTheme()"
  # Keep only the first occurrence
  awk '
    /const.*colors.*useTheme/ {
      if (!seen) {
        print
        seen = 1
      }
      next
    }
    { print }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  
  echo "✅ Fixed $file"
}

# Fix all files
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    fix_duplicates "$file"
  else
    echo "⚠️  File $file not found, skipping..."
  fi
done

echo "🎉 All duplicate declarations fixed!"



