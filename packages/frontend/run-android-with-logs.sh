#!/bin/bash
# Script to run Android app with Metro and capture logs

set -e

cd "$(dirname "$0")"

echo "Starting Metro bundler..."
yarn start > /tmp/metro.log 2>&1 &
METRO_PID=$!
echo "Metro started (PID: $METRO_PID)"

# Wait for Metro to be ready
echo "Waiting for Metro to start..."
sleep 8

# Check if emulator is connected
if ! /home/jordanlapp/Android/Sdk/platform-tools/adb devices | grep -q "device$"; then
    echo "ERROR: No Android device/emulator found!"
    echo "Please start an emulator or connect a device"
    kill $METRO_PID 2>/dev/null || true
    exit 1
fi

echo "Installing APK..."
/home/jordanlapp/Android/Sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk

echo "Launching app..."
/home/jordanlapp/Android/Sdk/platform-tools/adb shell am start -n com.negascout.bianca/.MainActivity

echo ""
echo "=== Capturing logs (Ctrl+C to stop) ==="
echo ""

# Clear logcat and capture React Native errors
/home/jordanlapp/Android/Sdk/platform-tools/adb logcat -c
/home/jordanlapp/Android/Sdk/platform-tools/adb logcat | grep -E "(ReactNativeJS|ReactNative|expo|font|Error|Exception|main|AppRegistry|WARN|ERROR)" --line-buffered

# Cleanup on exit
trap "kill $METRO_PID 2>/dev/null || true" EXIT
