#!/bin/bash

# iOS Setup Script for Bianca App
# This script helps you set up iOS development with your newly approved Apple Developer account

set -e

echo "🚀 Setting up iOS development for Bianca App"
echo ""

# Step 1: Login to EAS
echo "📱 Step 1: Logging in to Expo/EAS..."
echo "   (If you're not logged in, you'll be prompted to log in)"
eas login

echo ""
echo "✅ Logged in to EAS"
echo ""

# Step 2: Configure EAS project
echo "⚙️  Step 2: Configuring EAS project..."
eas build:configure

echo ""
echo "✅ EAS project configured"
echo ""

# Step 3: Set up iOS credentials
echo "🔐 Step 3: Setting up iOS credentials..."
echo "   EAS will help you set up certificates and provisioning profiles."
echo "   You'll need your Apple Developer account credentials."
echo ""
read -p "Press Enter to continue with credential setup..."

eas credentials

echo ""
echo "✅ iOS credentials configured"
echo ""

# Step 4: Instructions for App Store Connect
echo "📋 Step 4: App Store Connect Setup"
echo ""
echo "Now you need to:"
echo "1. Go to https://appstoreconnect.apple.com"
echo "2. Click '+' → New App"
echo "3. Fill in:"
echo "   - Platform: iOS"
echo "   - Name: Bianca"
echo "   - Primary Language: English"
echo "   - Bundle ID: com.negascout.bianca"
echo "   - SKU: bianca-ios-001 (or any unique identifier)"
echo "4. Save and note the App ID (you'll need it for eas.json)"
echo ""
echo "To find your Team ID:"
echo "1. Go to https://developer.apple.com/account"
echo "2. Click 'Membership' in the sidebar"
echo "3. Your Team ID is listed there"
echo ""
read -p "Press Enter when you have your App ID and Team ID..."

# Step 5: Update eas.json
echo ""
echo "📝 Step 5: Updating eas.json with your credentials"
echo ""
read -p "Enter your Apple ID (email): " APPLE_ID
read -p "Enter your App Store Connect App ID: " APP_ID
read -p "Enter your Apple Team ID: " TEAM_ID

# Update eas.json (this is a simple approach - you may want to edit manually)
echo ""
echo "Please manually update eas.json with these values:"
echo "  appleId: $APPLE_ID"
echo "  ascAppId: $APP_ID"
echo "  appleTeamId: $TEAM_ID"
echo ""
echo "The eas.json file is located at: packages/mobile/eas.json"
echo ""

# Step 6: Test build
echo "🧪 Step 6: Ready to test build!"
echo ""
echo "You can now run:"
echo "  yarn build:ios:prod:cloud    # Build for device/TestFlight"
echo "  yarn build:ios:sim           # Build for simulator (faster/cheaper)"
echo ""
echo "After building, submit to TestFlight with:"
echo "  yarn submit:ios"
echo ""

echo "✅ iOS setup complete!"
echo ""
echo "Next steps:"
echo "1. Update eas.json with your Apple credentials (see above)"
echo "2. Run: yarn build:ios:prod:cloud"
echo "3. Run: yarn submit:ios"
echo "4. Test on your iPhone via TestFlight"
