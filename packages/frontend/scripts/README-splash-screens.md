# Splash Screen Generation

This directory contains scripts to generate splash screens for iOS, Android, and web from your app icon.

## Quick Start

When you're ready to add splash screens for mobile builds:

1. **Generate splash screens:**
   ```bash
   cd packages/frontend
   ./scripts/generate-splash-screens.sh
   ```
   
   Or specify a custom icon and background color:
   ```bash
   ./scripts/generate-splash-screens.sh assets/images/app-icon-all.png "#191015"
   ```

2. **Add splash configuration to app.json:**
   ```bash
   ./scripts/add-splash-to-config.sh
   ```
   
   Then manually add the configuration shown to `app.json` and `app.staging.json`.

## What Gets Generated

The script creates the following splash screens:

- `splash-logo-all.png` - Universal splash (1284x2778)
- `splash-logo-android-universal.png` - Android (1284x2778)
- `splash-logo-ios-mobile.png` - iPhone (1242x2436)
- `splash-logo-ios-tablet.png` - iPad (2048x2732)
- `splash-logo-web.png` - Web (1280x720)

All splash screens:
- Use your app icon centered on the screen
- Use the background color `#191015` (configurable)
- Are properly sized for each platform

## Requirements

- ImageMagick (`convert` command) must be installed
  - Linux: `sudo apt-get install imagemagick`
  - Mac: `brew install imagemagick`

## Notes

- Splash screens are only needed for native builds (iOS/Android), not web
- The generated files are already blocked from web builds in `metro.config.js`
- You can regenerate splash screens anytime by running the script again

