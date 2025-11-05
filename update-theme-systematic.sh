#!/bin/bash

# Script to systematically update all screens and components to use theme colors
# This script will add useTheme hook and createStyles function to files that need them

echo "🎨 Starting systematic theme update..."

# Function to update a file with theme support
update_file() {
    local file="$1"
    local file_type="$2"  # "screen" or "component"
    
    echo "📝 Updating $file_type: $file"
    
    # Check if file already has useTheme
    if grep -q "useTheme" "$file"; then
        echo "  ✅ Already has useTheme"
        return
    fi
    
    # Check if file has StyleSheet import
    if ! grep -q "StyleSheet" "$file"; then
        # Add StyleSheet to imports
        sed -i 's/import { View, Text/import { View, Text, StyleSheet/' "$file"
        sed -i 's/import { View }/import { View, StyleSheet/' "$file"
        sed -i 's/import { Text }/import { Text, StyleSheet/' "$file"
    fi
    
    # Add useTheme import
    if ! grep -q "useTheme" "$file"; then
        # Find the last import line and add useTheme import after it
        sed -i '/^import.*from.*$/a import { useTheme } from "app/theme/ThemeContext"' "$file"
    fi
    
    # Add createStyles function before the component
    if ! grep -q "createStyles" "$file"; then
        # Find the component declaration and add createStyles before it
        sed -i '/^export.*function\|^export.*const.*=.*()/i\
const createStyles = (colors: any) => StyleSheet.create({\
  container: {\
    flex: 1,\
    backgroundColor: colors.palette.neutral100,\
  },\
  text: {\
    color: colors.palette.neutral800,\
  },\
})\
' "$file"
    fi
    
    # Add useTheme hook and loading check
    if ! grep -q "const { colors" "$file"; then
        # Find the component function and add useTheme hook
        sed -i '/^export.*function\|^export.*const.*=.*()/a\
  const { colors, isLoading: themeLoading } = useTheme()\
\
  if (themeLoading) {\
    return null\
  }\
\
  const styles = createStyles(colors)\
' "$file"
    fi
    
    echo "  ✅ Updated $file"
}

# Update remaining screens
echo "🖥️  Updating screens..."
for screen in app/screens/EmailVerificationRequiredScreen.tsx app/screens/ConfirmResetScreen.tsx; do
    if [ -f "$screen" ]; then
        update_file "$screen" "screen"
    fi
done

# Update critical components first
echo "🧩 Updating critical components..."
critical_components=(
    "app/components/Button.tsx"
    "app/components/Text.tsx"
    "app/components/Screen.tsx"
    "app/components/Header.tsx"
    "app/components/Card.tsx"
    "app/components/TextField.tsx"
    "app/components/Icon.tsx"
)

for component in "${critical_components[@]}"; do
    if [ -f "$component" ]; then
        update_file "$component" "component"
    fi
done

echo "🎉 Systematic theme update completed!"
echo "📋 Next steps:"
echo "  1. Test the app to ensure it loads"
echo "  2. Manually review and fix any syntax errors"
echo "  3. Update remaining components as needed"



