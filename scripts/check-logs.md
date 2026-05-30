# How to Check Logs for Production App

## Method 1: Using ADB Logcat (Recommended for Android)

### Prerequisites
- Install Android SDK Platform Tools (includes `adb`)
- Enable USB Debugging on your Android device
- Connect device via USB

### Basic Commands

```bash
# View all logs in real-time
adb logcat

# Filter by your app's package name
adb logcat | grep "com.yraylabs.breakfree"

# Filter by React Native logs
adb logcat | grep -E "ReactNativeJS|console"

# Filter by errors only
adb logcat *:E

# Filter by your app + errors
adb logcat | grep -E "com.yraylabs.breakfree|ERROR"

# Save logs to file
adb logcat > app-logs.txt

# Clear logs and start fresh
adb logcat -c && adb logcat
```

### Filter by Log Level
```bash
# Verbose (most detailed)
adb logcat *:V

# Debug
adb logcat *:D

# Info
adb logcat *:I

# Warning
adb logcat *:W

# Error
adb logcat *:E

# Fatal
adb logcat *:F
```

### Filter by Tag
```bash
# React Native JavaScript logs
adb logcat | grep "ReactNativeJS"

# React Native errors
adb logcat | grep "ReactNativeJS.*ERROR"

# Your app's console.log statements
adb logcat | grep "console"
```

## Method 2: Using React Native Debugger

If you have a development build installed:

```bash
# Start Metro bundler
npx expo start

# In another terminal, view logs
npx react-native log-android
```

## Method 3: View Logs via Android Studio

1. Open Android Studio
2. Connect your device
3. Go to **View → Tool Windows → Logcat**
4. Filter by package: `com.yraylabs.breakfree`

## Method 4: Remote Logging (Recommended for Production)

For production apps, consider integrating a remote logging service:

### Option A: Sentry (Recommended)
- Automatic error tracking
- Stack traces
- User context
- Works in production builds

### Option B: LogRocket
- Session replay
- Console logs
- Network requests

### Option C: Firebase Crashlytics
- Free with Firebase
- Automatic crash reporting
- Custom logs

## Quick Debug Script

Use the provided `check-logs.sh` script for easy log viewing.
