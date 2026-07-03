#!/bin/bash

# Script to easily check logs for BreakFree Android app
# Usage: ./scripts/check-logs.sh [filter]

PACKAGE_NAME="com.maskyray.heysolana"
FILTER="${1:-all}"

echo "🔍 Checking logs for $PACKAGE_NAME"
echo "Filter: $FILTER"
echo ""

# Check if adb is available
if ! command -v adb &> /dev/null; then
    echo "❌ Error: adb not found. Please install Android SDK Platform Tools."
    echo "   Download from: https://developer.android.com/studio/releases/platform-tools"
    exit 1
fi

# Check if device is connected
if ! adb devices | grep -q "device$"; then
    echo "❌ Error: No Android device connected."
    echo "   Please:"
    echo "   1. Connect your device via USB"
    echo "   2. Enable USB Debugging in Developer Options"
    exit 1
fi

echo "✅ Device connected"
echo "📱 Starting logcat..."
echo "   Press Ctrl+C to stop"
echo ""

case $FILTER in
    "errors"|"error"|"e")
        adb logcat | grep -E "$PACKAGE_NAME|ReactNativeJS|ERROR|FATAL" --color=always
        ;;
    "react"|"rn"|"js")
        adb logcat | grep -E "ReactNativeJS|console" --color=always
        ;;
    "backup"|"drive"|"google")
        adb logcat | grep -E "ReactNativeJS|GoogleDriveBackup" --color=always
        ;;
    "app"|"package")
        adb logcat | grep "$PACKAGE_NAME" --color=always
        ;;
    "all"|*)
        adb logcat | grep -E "$PACKAGE_NAME|ReactNativeJS" --color=always
        ;;
esac
