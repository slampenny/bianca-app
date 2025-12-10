#!/bin/bash

# Helper script to add splash screen configuration to app.json files
# Run this after generating splash screens with generate-splash-screens.sh

set -e

BG_COLOR="${1:-#191015}"

echo "Adding splash screen configuration to app.json files..."
echo "Background color: $BG_COLOR"
echo ""

# Check if splash screens exist
if [ ! -f "assets/images/splash-logo-all.png" ]; then
  echo "Error: Splash screens not found. Run generate-splash-screens.sh first."
  exit 1
fi

# Create a temporary JSON file with splash configuration
cat > /tmp/splash-config.json << EOF
{
  "splash": {
    "image": "./assets/images/splash-logo-all.png",
    "resizeMode": "contain",
    "backgroundColor": "$BG_COLOR"
  }
EOF

echo "✅ Splash screen configuration template created"
echo ""
echo "Manually add the following to your app.json and app.staging.json:"
echo ""
echo "At the root expo level (after \"icon\"):"
cat /tmp/splash-config.json
echo ""
echo ""
echo "In the \"android\" section:"
echo "  \"splash\": {"
echo "    \"image\": \"./assets/images/splash-logo-android-universal.png\","
echo "    \"resizeMode\": \"contain\","
echo "    \"backgroundColor\": \"$BG_COLOR\""
echo "  },"
echo ""
echo "In the \"ios\" section:"
echo "  \"splash\": {"
echo "    \"image\": \"./assets/images/splash-logo-ios-mobile.png\","
echo "    \"tabletImage\": \"./assets/images/splash-logo-ios-tablet.png\","
echo "    \"resizeMode\": \"contain\","
echo "    \"backgroundColor\": \"$BG_COLOR\""
echo "  },"
echo ""
echo "In the \"web\" section (optional):"
echo "  \"splash\": {"
echo "    \"image\": \"./assets/images/splash-logo-web.png\","
echo "    \"resizeMode\": \"contain\","
echo "    \"backgroundColor\": \"$BG_COLOR\""
echo "  },"

rm /tmp/splash-config.json

