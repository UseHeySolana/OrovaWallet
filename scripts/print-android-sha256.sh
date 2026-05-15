#!/usr/bin/env bash
# Print SHA256 fingerprints for assetlinks.json (Android passkeys).
# Add release fingerprint to backend .env: PASSKEY_ANDROID_SHA256_CERT=AA:BB:...

set -euo pipefail

echo "=== Project debug.keystore (android/app/debug.keystore) ==="
if [[ -f android/app/debug.keystore ]]; then
  keytool -list -v -keystore android/app/debug.keystore -storepass android -keypass android 2>/dev/null | grep "SHA256:" || true
else
  echo "(not found)"
fi

echo ""
echo "=== Default ~/.android/debug.keystore ==="
if [[ -f "$HOME/.android/debug.keystore" ]]; then
  keytool -list -v -keystore "$HOME/.android/debug.keystore" -alias androiddebugkey -storepass android -keypass android 2>/dev/null | grep "SHA256:" || true
else
  echo "(not found)"
fi

echo ""
echo "=== Release (run from project root after EAS/local release keystore exists) ==="
echo "Play Console → App signing → App signing key certificate → SHA-256"
echo "Or: keytool -list -v -keystore YOUR_RELEASE.keystore -alias YOUR_ALIAS"
