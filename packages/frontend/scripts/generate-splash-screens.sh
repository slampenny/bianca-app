#!/bin/bash

# Script to generate splash screens from app icon
# Usage: ./scripts/generate-splash-screens.sh [source-icon] [background-color]
# Example: ./scripts/generate-splash-screens.sh assets/images/icon.png "#191015"

set -e

SOURCE_ICON="${1:-assets/images/icon.png}"
BG_COLOR="${2:-#191015}"
OUTPUT_DIR="assets/images"

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
  echo "Error: Source icon not found: $SOURCE_ICON"
  exit 1
fi

# Check if ImageMagick is available
if ! command -v convert &> /dev/null; then
  echo "Error: ImageMagick (convert) is not installed"
  echo "Install with: sudo apt-get install imagemagick (Linux) or brew install imagemagick (Mac)"
  exit 1
fi

echo "Generating splash screens from: $SOURCE_ICON"
echo "Background color: $BG_COLOR"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Function to create a splash screen
create_splash() {
  local width=$1
  local height=$2
  local output=$3
  local icon_size=$4
  
  echo "Creating $output (${width}x${height})..."
  
  # Create a solid color background
  convert -size ${width}x${height} xc:"$BG_COLOR" \
    \( "$SOURCE_ICON" -resize ${icon_size}x${icon_size} \) \
    -gravity center -composite \
    "$OUTPUT_DIR/$output"
}

# Standard Expo splash screen dimensions
# Universal (works for most devices)
create_splash 1284 2778 "splash-logo-all.png" 400

# Android specific
create_splash 1284 2778 "splash-logo-android-universal.png" 400

# iOS specific
# iPhone (mobile)
create_splash 1242 2436 "splash-logo-ios-mobile.png" 400
# iPad (tablet)
create_splash 2048 2732 "splash-logo-ios-tablet.png" 500

# Web (optional, smaller)
create_splash 1280 720 "splash-logo-web.png" 300

echo ""
echo "✅ Splash screens generated successfully!"
echo ""
echo "Files created:"
ls -lh "$OUTPUT_DIR"/splash-logo-*.png
echo ""
echo "Next steps:"
echo "1. Review the generated splash screens"
echo "2. Update app.json and app.staging.json with splash screen configuration"
echo "3. Test on your target platforms"

