import { Platform } from "react-native";

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  "";

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || "";

const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, DRIVE_APPDATA_SCOPE };

/** Reversed iOS client ID used as the OAuth redirect URL scheme. */
export function googleIosUrlScheme(iosClientId = GOOGLE_IOS_CLIENT_ID): string | null {
  const match = iosClientId.match(/^([\w-]+)\.apps\.googleusercontent\.com$/);
  return match ? `com.googleusercontent.apps.${match[1]}` : null;
}

export function isGoogleSignInConfigured(): boolean {
  if (!GOOGLE_WEB_CLIENT_ID) return false;
  // iOS needs an iOS OAuth client (or GoogleService-Info.plist); without it
  // GoogleSignin.configure() throws.
  if (Platform.OS === "ios") return GOOGLE_IOS_CLIENT_ID.length > 0;
  return true;
}
