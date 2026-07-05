#!/bin/bash
# Print Android debug SHA-1/SHA-256 for Firebase Google Sign-In setup.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CREDENTIALS_FILE="${CREDENTIALS_JSON:-$PROJECT_ROOT/credentials.json}"

KEYSTORE="${ANDROID_DEBUG_KEYSTORE:-$HOME/.android/debug.keystore}"

KEYSTORE_SOLANA_MOBILE=""
KEY_ALIAS=""
STORE_PASS=""
KEY_PASS=""

if [[ -f "$CREDENTIALS_FILE" ]]; then
  mapfile -t CREDS < <(python3 - "$CREDENTIALS_FILE" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    k = json.load(f)["android"]["keystore"]
print(k["keystorePath"])
print(k["keyAlias"])
print(k["keystorePassword"])
print(k["keyPassword"])
PY
  )
  KEYSTORE_REL="${CREDS[0]}"
  KEY_ALIAS="${CREDS[1]}"
  STORE_PASS="${CREDS[2]}"
  KEY_PASS="${CREDS[3]}"

  if [[ "$KEYSTORE_REL" == ./* ]]; then
    KEYSTORE_SOLANA_MOBILE="$PROJECT_ROOT/${KEYSTORE_REL#./}"
  elif [[ "$KEYSTORE_REL" != /* ]]; then
    KEYSTORE_SOLANA_MOBILE="$PROJECT_ROOT/$KEYSTORE_REL"
  else
    KEYSTORE_SOLANA_MOBILE="$KEYSTORE_REL"
  fi
fi

KEYSTORE_SOLANA_MOBILE="${ANDROID_DEBUG_KEYSTORE_SOLANA_MOBILE:-$KEYSTORE_SOLANA_MOBILE}"

if [[ ! -f "$KEYSTORE" ]]; then
  echo "Debug keystore not found at: $KEYSTORE"
  exit 1
fi

if [[ -z "$KEYSTORE_SOLANA_MOBILE" || ! -f "$KEYSTORE_SOLANA_MOBILE" ]]; then
  echo "Solana Mobile keystore not found at: ${KEYSTORE_SOLANA_MOBILE:-<not configured>}"
  echo "Set ANDROID_DEBUG_KEYSTORE_SOLANA_MOBILE or add credentials.json at: $CREDENTIALS_FILE"
  exit 1
fi

if [[ -z "$KEY_ALIAS" || -z "$STORE_PASS" || -z "$KEY_PASS" ]]; then
  echo "Missing keystore alias/password. Add android.keystore entries to: $CREDENTIALS_FILE"
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
echo "Solana Mobile keystore: $KEYSTORE_SOLANA_MOBILE"
keytool -list -v \
  -keystore "$KEYSTORE_SOLANA_MOBILE" \
  -alias "$KEY_ALIAS" \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" 2>/dev/null | grep -E "SHA1:|SHA256:"

echo ""
echo "Add SHA-1 in Firebase Console:"
echo "  Project settings → Your apps → Android (com.maskyray.heysolana) → Add fingerprint"
echo "Then download a fresh google-services.json and rebuild the native app."
