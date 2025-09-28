#!/bin/bash

echo "🔐 Setting up SSO for Bianca App"
echo "================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    touch .env
fi

echo "Please enter your OAuth credentials:"
echo ""

# Get Google Client ID
read -p "Google Client ID: " GOOGLE_CLIENT_ID
if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "❌ Google Client ID is required"
    exit 1
fi

# Get Microsoft Client ID
read -p "Microsoft Client ID: " MICROSOFT_CLIENT_ID
if [ -z "$MICROSOFT_CLIENT_ID" ]; then
    echo "❌ Microsoft Client ID is required"
    exit 1
fi

# Get Microsoft Tenant ID
read -p "Microsoft Tenant ID (or 'common'): " MICROSOFT_TENANT_ID
if [ -z "$MICROSOFT_TENANT_ID" ]; then
    MICROSOFT_TENANT_ID="common"
fi

# Write to .env file
echo "Writing configuration to .env file..."

# Remove existing OAuth config if present
sed -i '/EXPO_PUBLIC_GOOGLE_CLIENT_ID/d' .env
sed -i '/EXPO_PUBLIC_MICROSOFT_CLIENT_ID/d' .env
sed -i '/EXPO_PUBLIC_MICROSOFT_TENANT_ID/d' .env

# Add new OAuth config
echo "" >> .env
echo "# OAuth Configuration" >> .env
echo "EXPO_PUBLIC_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> .env
echo "EXPO_PUBLIC_MICROSOFT_CLIENT_ID=$MICROSOFT_CLIENT_ID" >> .env
echo "EXPO_PUBLIC_MICROSOFT_TENANT_ID=$MICROSOFT_TENANT_ID" >> .env

echo ""
echo "✅ OAuth configuration saved to .env file"
echo ""
echo "Next steps:"
echo "1. Run 'yarn start' to start the development server"
echo "2. Test SSO login on the login screen"
echo "3. Check the console for any errors"
echo ""
echo "Redirect URIs to configure in OAuth providers:"
echo "- Development: http://localhost:19006"
echo "- Staging: https://staging.app.myphonefriend.com"
echo "- Production: https://app.myphonefriend.com"
echo "- Mobile: https://auth.expo.io/@negascout/bianca"
echo ""
echo "Add ALL of these URIs to your Google and Microsoft OAuth apps!"
