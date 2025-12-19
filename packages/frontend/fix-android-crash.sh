#!/bin/bash
# Script to fix Android crash by cleaning caches and rebuilding

set -e

cd "$(dirname "$0")"

echo "🧹 Cleaning Metro bundler cache..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-* 2>/dev/null || true

echo "🧹 Cleaning Android build..."
if [ -d "android" ]; then
  cd android
  ./gradlew clean 2>/dev/null || true
  rm -rf app/build
  rm -rf .gradle
  cd ..
fi

echo "🧹 Cleaning watchman (if installed)..."
watchman watch-del-all 2>/dev/null || true

echo "🔄 Regenerating native code to ensure expo-font is excluded..."
npx expo prebuild --clean --platform android

echo "✅ Cleanup and rebuild complete!"
echo ""
echo "Now run:"
echo "  yarn start --clear"
echo "  (In another terminal) yarn android"
echo ""
echo "Or use the run script:"
echo "  ./run-android-with-logs.sh"



