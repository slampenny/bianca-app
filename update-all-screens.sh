#!/bin/bash

# Script to systematically update all screens to use dynamic theme colors
# This script will:
# 1. Replace hardcoded color imports with useTheme hook
# 2. Add theme loading checks
# 3. Convert static styles to dynamic functions

echo "🎨 Updating all screens to use dynamic theme colors..."

# List of screens to update (excluding already updated ones)
SCREENS=(
  "app/screens/OrgScreen.tsx"
  "app/screens/PatientScreen.tsx" 
  "app/screens/AlertScreen.tsx"
  "app/screens/SchedulesScreen.tsx"
  "app/screens/ConversationsScreen.tsx"
  "app/screens/CallScreen.tsx"
  "app/screens/CaregiverScreen.tsx"
  "app/screens/CaregiversScreen.tsx"
  "app/screens/CaregiverInvitedScreen.tsx"
  "app/screens/PaymentInfoScreen.tsx"
  "app/screens/ReportsScreen.tsx"
  "app/screens/HealthReportScreen.tsx"
  "app/screens/SentimentAnalysisScreen.tsx"
  "app/screens/MedicalAnalysisScreen.tsx"
  "app/screens/RegisterScreen.tsx"
  "app/screens/SignupScreen.tsx"
  "app/screens/LogoutScreen.tsx"
  "app/screens/EmailVerificationRequiredScreen.tsx"
  "app/screens/EmailVerifiedScreen.tsx"
  "app/screens/RequestResetScreen.tsx"
  "app/screens/PrivacyScreen.tsx"
  "app/screens/TermsScreen.tsx"
  "app/screens/PrivacyPracticesScreen.tsx"
  "app/screens/LoadingScreen.tsx"
)

# Function to update a single screen
update_screen() {
  local file="$1"
  echo "📱 Updating $file..."
  
  # Check if file exists
  if [ ! -f "$file" ]; then
    echo "⚠️  File $file not found, skipping..."
    return
  fi
  
  # Check if file already uses useTheme
  if grep -q "useTheme" "$file"; then
    echo "✅ $file already uses useTheme, skipping..."
    return
  fi
  
  # Create backup
  cp "$file" "$file.backup"
  
  # Replace color import with useTheme import
  sed -i 's/import { colors } from "app\/theme\/colors"/import { useTheme } from "app\/theme\/ThemeContext"/g' "$file"
  sed -i 's/import { colors } from "..\/theme\/colors"/import { useTheme } from "..\/theme\/ThemeContext"/g' "$file"
  sed -i 's/import { colors } from "..\/..\/theme\/colors"/import { useTheme } from "..\/..\/theme\/ThemeContext"/g' "$file"
  
  # Add useTheme hook after existing hooks
  if grep -q "const.*useState\|const.*useEffect\|const.*useSelector\|const.*useDispatch" "$file"; then
    # Find the last hook and add useTheme after it
    sed -i '/const.*useState\|const.*useEffect\|const.*useSelector\|const.*useDispatch/{
      :a
      n
      /^[[:space:]]*$/!ba
      i\
  const { colors, isLoading: themeLoading } = useTheme()
    }' "$file"
  else
    # Add at the beginning of the function
    sed -i '/^export.*function\|^export.*const.*=.*({/{
      a\
  const { colors, isLoading: themeLoading } = useTheme()
    }' "$file"
  fi
  
  # Add loading check before return statement
  sed -i '/^[[:space:]]*return[[:space:]]*(/{
    i\
  if (themeLoading) {\
    return null\
  }\
\
  const styles = createStyles(colors)\
    }' "$file"
  
  # Convert styles to function
  sed -i 's/const styles = StyleSheet\.create(/const createStyles = (colors: any) => StyleSheet.create(/g' "$file"
  
  echo "✅ Updated $file"
}

# Update all screens
for screen in "${SCREENS[@]}"; do
  update_screen "$screen"
done

echo "🎉 All screens updated! Testing app loading..."

# Test if app loads without errors
cd /home/jordanlapp/code/bianca-app/bianca-app-frontend
npx playwright test test/e2e/app-loading.e2e.test.ts --reporter=line --timeout=10000

echo "✨ Theme system update complete!"
