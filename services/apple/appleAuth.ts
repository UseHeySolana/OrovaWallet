import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

export type AppleAuthSession = {
  id: string;
  identityToken: string;
  email: string;
  fullName: string;
};

let pendingAppleAuth: AppleAuthSession | null = null;

export function peekPendingAppleAuth(): AppleAuthSession | null {
  return pendingAppleAuth;
}

export function stashPendingAppleAuth(session: AppleAuthSession): void {
  pendingAppleAuth = session;
}

export function consumePendingAppleAuth(): AppleAuthSession | null {
  const session = pendingAppleAuth;
  pendingAppleAuth = null;
  return session;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null
): string {
  if (!fullName) return "";
  return [fullName.givenName, fullName.familyName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();
}

export async function signInWithAppleForAuth(): Promise<AppleAuthSession> {
  if (Platform.OS !== "ios") {
    throw new Error("Sign in with Apple is only available on iOS");
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error("Sign in with Apple is not available on this device");
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Could not get Apple identity token");
  }
  if (!credential.user) {
    throw new Error("Could not get Apple user identifier");
  }

  const session: AppleAuthSession = {
    id: credential.user,
    identityToken: credential.identityToken,
    email: (credential.email ?? "").trim().toLowerCase(),
    fullName: formatAppleFullName(credential.fullName),
  };

  stashPendingAppleAuth(session);
  return session;
}

export function getAppleSignInErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
  ) {
    return "Sign in with Apple was cancelled";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Sign in with Apple failed";
}
