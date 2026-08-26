import { Platform } from "react-native";

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  "";

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || "";

const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, DRIVE_APPDATA_SCOPE };

export function isGoogleSignInConfigured(): boolean {
  // TODO: re-enable once iOS has GoogleService-Info.plist / iosClientId.
  if (Platform.OS === "ios") return false;
  return GOOGLE_WEB_CLIENT_ID.length > 0;
}
