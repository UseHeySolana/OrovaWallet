import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import {
  DRIVE_APPDATA_SCOPE,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  isGoogleSignInConfigured,
} from "@/utils/google/googleConfig";
import { logBackup, logBackupError } from "@/services/backup/backupLogger";

let configured = false;

export function configureGoogleSignIn(): void {
  // TODO: re-enable once iOS has GoogleService-Info.plist / iosClientId.
  if (configured || !isGoogleSignInConfigured()) return;

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: ["openid", "profile", "email", DRIVE_APPDATA_SCOPE],
    offlineAccess: true,
  });
  configured = true;
  logBackup("google sign-in configured", {
    hasWebClientId: Boolean(GOOGLE_WEB_CLIENT_ID),
    hasIosClientId: Boolean(GOOGLE_IOS_CLIENT_ID),
  });
}

export type GoogleSignInResult = {
  accessToken: string;
  email: string;
  id: string;
};

export type GoogleAuthSession = {
  email: string;
  id: string;
  idToken: string;
  accessToken: string;
};

let pendingGoogleAuth: GoogleAuthSession | null = null;

export function peekPendingGoogleAuth(): GoogleAuthSession | null {
  return pendingGoogleAuth;
}

export function stashPendingGoogleAuth(session: GoogleAuthSession): void {
  pendingGoogleAuth = session;
}

export function consumePendingGoogleAuth(): GoogleAuthSession | null {
  const session = pendingGoogleAuth;
  pendingGoogleAuth = null;
  return session;
}

/** Refresh tokens for an existing Google session (e.g. before a backend call after restore). */
export async function refreshGoogleAuthSession(
  session: GoogleAuthSession
): Promise<GoogleAuthSession> {
  configureGoogleSignIn();
  try {
    const tokens = await GoogleSignin.getTokens();
    if (tokens.idToken && tokens.accessToken) {
      return {
        ...session,
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
      };
    }
  } catch {
    // fall through — caller may retry sign-in
  }
  return session;
}

export type GoogleAccountSelection = "silent-first" | "choose-account";

async function performGoogleSignIn(options?: {
  accountSelection?: GoogleAccountSelection;
}): Promise<void> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  logBackup("play services ok");

  if (options?.accountSelection === "choose-account") {
    try {
      await GoogleSignin.signOut();
      logBackup("signed out to show Google account picker");
    } catch {
      // non-fatal
    }

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      throw new Error("Google sign-in was cancelled");
    }
    logBackup("interactive sign-in ok (account picker)");
    return;
  }

  const alreadySignedIn = GoogleSignin.hasPreviousSignIn();
  logBackup("checking existing session", { alreadySignedIn });

  if (alreadySignedIn) {
    try {
      await GoogleSignin.signInSilently();
      logBackup("silent sign-in ok");
    } catch (silentError) {
      logBackupError("silent sign-in failed, showing account picker", silentError);
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        throw new Error("Google sign-in was cancelled");
      }
      logBackup("interactive sign-in ok");
    }
  } else {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      throw new Error("Google sign-in was cancelled");
    }
    logBackup("interactive sign-in ok");
  }
}

async function getCurrentGoogleUser() {
  const user = (await GoogleSignin.getCurrentUser())?.user;
  if (!user?.email) {
    throw new Error("Could not read your Google account email");
  }
  return user;
}

export async function signInWithGoogleForAuth(options?: {
  accountSelection?: GoogleAccountSelection;
}): Promise<GoogleAuthSession> {
  configureGoogleSignIn();

  if (!isGoogleSignInConfigured()) {
    throw new Error("Google Sign-In is not configured");
  }

  try {
    await performGoogleSignIn({
      accountSelection: options?.accountSelection ?? "choose-account",
    });

    try {
      await GoogleSignin.addScopes({ scopes: [DRIVE_APPDATA_SCOPE] });
      logBackup("drive.appdata scope granted (auth flow)");
    } catch (scopeError) {
      logBackupError("addScopes failed (may already be granted)", scopeError);
    }

    const tokens = await GoogleSignin.getTokens();
    const user = await getCurrentGoogleUser();
    if (!tokens.idToken) {
      throw new Error("Could not get Google ID token");
    }
    if (!tokens.accessToken) {
      throw new Error("Could not get Google access token");
    }

    const session: GoogleAuthSession = {
      email: user.email ?? "",
      id: user.id ?? "",
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
    };

    stashPendingGoogleAuth(session);
    return session;
  } catch (error) {
    logBackupError("google auth sign-in failed", error);
    throw error;
  }
}

export async function signInWithGoogleForBackup(options?: {
  accountSelection?: GoogleAccountSelection;
}): Promise<GoogleSignInResult> {
  configureGoogleSignIn();

  if (!isGoogleSignInConfigured()) {
    logBackupError("google sign-in not configured", null);
    throw new Error("Google Sign-In is not configured");
  }

  try {
    await performGoogleSignIn({
      accountSelection: options?.accountSelection ?? "silent-first",
    });

    try {
      await GoogleSignin.addScopes({ scopes: [DRIVE_APPDATA_SCOPE] });
      logBackup("drive.appdata scope granted");
    } catch (scopeError) {
      logBackupError("addScopes failed (may already be granted)", scopeError);
    }

    const tokens = await GoogleSignin.getTokens();
    const user = await getCurrentGoogleUser();
    if (!tokens.accessToken) {
      throw new Error("Could not get Google access token");
    }

    logBackup("access token received", {
      email: user.email ?? "—",
      tokenPreview: `${tokens.accessToken.slice(0, 8)}…`,
    });

    return {
      accessToken: tokens.accessToken,
      email: user.email ?? "",
      id: user.id ?? "",
    };
  } catch (error) {
    logBackupError("google sign-in failed", error);
    throw error;
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
    pendingGoogleAuth = null;
  } catch {
    // non-fatal
  }
}

export function getGoogleSignInErrorMessage(error: unknown): string {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return "Google sign-in was cancelled";
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      return "Google sign-in is already in progress";
    }
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return "Google Play Services is not available on this device";
    }
  }
  const raw =
    error instanceof Error ? error.message : String(error ?? "Google sign-in failed");
  if (/DEVELOPER_ERROR/i.test(raw)) {
    return (
      "Google Sign-In is misconfigured (DEVELOPER_ERROR). Add this device’s SHA-1 fingerprint " +
      "to Firebase → Project settings → Android app → com.maskyray.heysolana, then re-download " +
      "google-services.json and rebuild the app."
    );
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return raw || "Google sign-in failed";
}
