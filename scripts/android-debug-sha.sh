#!/bin/bash
# Print Android debug SHA-1/SHA-256 for Firebase Google Sign-In setup.

set -e

KEYSTORE="${ANDROID_DEBUG_KEYSTORE:-$HOME/.android/debug.keystore}"

if [[ ! -f "$KEYSTORE" ]]; then
  echo "Debug keystore not found at: $KEYSTORE"
  exit 1
fi

echo "Android debug keystore: $KEYSTORE"
echo ""
keytool -list -v \
  -keystore "$KEYSTORE" \
  -alias androiddebugkey \
  -storepass android \
  -keypass android 2>/dev/null | grep -E "SHA1:|SHA256:"

echo ""
echo "Add SHA-1 in Firebase Console:"
echo "  Project settings → Your apps → Android (com.maskyray.heysolana) → Add fingerprint"
echo "Then download a fresh google-services.json and rebuild the native app."
