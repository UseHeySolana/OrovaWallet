import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { BASE_URL } from "@/utils/constant";
import { request } from "@/utils/request/db";
import { phoneForPushApi } from "@/utils/phone/phoneE164";
import type { UserType } from "@/utils/types/user.types";

const PUSH_TOKEN_STORAGE_KEY = "@heysolana/expo_push_token";
const ANDROID_CHANNEL_ID = "heysolana-push";
const EXPO_PUSH_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[.+\]$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cachedPushToken: string | null = null;
let permissionRequested = false;

function getEasProjectId(): string | undefined {
  const raw =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  const projectId = typeof raw === "string" ? raw.trim() : "";
  return UUID_RE.test(projectId) ? projectId : undefined;
}

function isExpoPushToken(token: string | null | undefined): token is string {
  return typeof token === "string" && EXPO_PUSH_TOKEN_RE.test(token.trim());
}

/** Addressbook ids only — drop Google subject ids / non-integers that fail Laravel `integer`. */
function coerceAddressbookUserId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d{1,10}$/.test(value.trim())) {
    const n = Number(value.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  return undefined;
}

async function clearStoredPushToken(): Promise<void> {
  cachedPushToken = null;
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export function getCachedExpoPushToken(): string | null {
  return cachedPushToken;
}

export async function ensurePushPermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "HeySolana",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") return true;

  if (!permissionRequested) {
    permissionRequested = true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === "granted";
  }

  return false;
}

async function readStoredPushToken(): Promise<string | null> {
  if (isExpoPushToken(cachedPushToken)) return cachedPushToken;
  const stored = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (isExpoPushToken(stored)) {
    cachedPushToken = stored.trim();
    return cachedPushToken;
  }
  if (stored) {
    // Stale FCM/APNs tokens from older builds cause backend 422s.
    await clearStoredPushToken();
  }
  return null;
}

export async function resolveExpoPushToken(forceRefresh = false): Promise<string | null> {
  const granted = await ensurePushPermissions();
  if (!granted) return null;

  if (!forceRefresh) {
    const existing = await readStoredPushToken();
    if (existing) return existing;
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    console.warn("[push] Missing or invalid EAS projectId in app config");
    return null;
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const data =
      typeof tokenResult?.data === "string" ? tokenResult.data.trim() : "";
    if (!isExpoPushToken(data)) {
      console.warn("[push] Rejecting non-Expo push token from device");
      await clearStoredPushToken();
      return null;
    }
    cachedPushToken = data;
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, data);
    return data;
  } catch (err) {
    if (err instanceof Error && err.message === "Aborted") {
      return readStoredPushToken();
    }
    console.warn("[push] Could not get Expo push token (dev/simulator?)", err);
    return null;
  }
}

export type RegisterPushTokenParams = {
  phone_number?: string;
  user_id?: number;
  user?: UserType | null;
};

export function resolvePhoneForPushRegistration(
  params: RegisterPushTokenParams
): string | undefined {
  return params.phone_number?.trim() || phoneForPushApi(params.user ?? null);
}

/** Stable identity key so push registration works for phone, wallet, email, or user id. */
export function pushRegistrationIdentityKey(
  params: RegisterPushTokenParams
): string | null {
  const phone = resolvePhoneForPushRegistration(params);
  if (phone) return `phone:${phone}`;

  const userId = coerceAddressbookUserId(params.user_id ?? params.user?.id);
  if (userId != null) return `user:${userId}`;

  const wallet = params.user?.wallet_address?.trim();
  if (wallet) return `wallet:${wallet}`;

  const email = params.user?.email?.trim().toLowerCase();
  if (email) return `email:${email}`;

  return null;
}

export function canRegisterPushForUser(
  user: UserType | null | undefined
): boolean {
  return pushRegistrationIdentityKey({ user }) != null;
}

export async function registerPushTokenWithBackend(
  params: RegisterPushTokenParams = {}
): Promise<boolean> {
  // TODO: re-enable once iOS push registration is fixed on the backend.
  if (Platform.OS === "ios") {
    return false;
  }

  if (!BASE_URL) {
    console.warn("[push] EXPO_PUBLIC_API_URL not set; skipping token registration");
    return false;
  }

  if (!pushRegistrationIdentityKey(params)) {
    console.warn("[push] No user identity for token registration");
    return false;
  }

  const pushToken = await resolveExpoPushToken();
  if (!pushToken) return false;

  const deviceType = Platform.OS === "ios" ? "ios" : "android";
  const body: Record<string, string | number> = {
    push_token: pushToken,
    device_type: deviceType,
  };
  const projectId = getEasProjectId();
  if (projectId) body.eas_project_id = projectId;
  const phone = resolvePhoneForPushRegistration(params);
  if (phone) body.phone_number = phone;
  const userId = coerceAddressbookUserId(params.user_id ?? params.user?.id);
  if (userId != null) body.user_id = userId;
  const wallet = params.user?.wallet_address?.trim();
  if (wallet && wallet.length <= 64) body.wallet_address = wallet;
  const email = params.user?.email?.trim().toLowerCase();
  // Only send values Laravel's `email` rule will accept.
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) body.email = email;

  try {
    const response = await request.postJson(body, "/notifications/register-token");
    if (!response.ok) {
      const text = await response.text();
      console.warn("[push] register-token failed:", response.status, text, {
        device_type: deviceType,
        has_eas_project_id: Boolean(projectId),
        has_phone: Boolean(phone),
        has_user_id: userId != null,
        has_wallet: Boolean(wallet),
        has_email: Boolean(email),
        push_token_prefix: pushToken.slice(0, 24),
      });
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[push] register-token error:", err);
    return false;
  }
}

export async function deactivatePushTokenOnBackend(): Promise<void> {
  const pushToken =
    cachedPushToken ?? (await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY));
  if (!pushToken || !BASE_URL) return;

  try {
    await request.postJson({ push_token: pushToken }, "/notifications/deactivate-token");
  } catch (err) {
    console.warn("[push] deactivate-token error:", err);
  } finally {
    cachedPushToken = null;
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}

export function attachPushTokenRefreshListener(
  onToken: (token: string) => void
): () => void {
  const sub = Notifications.addPushTokenListener(({ data }) => {
    const token = typeof data === "string" ? data.trim() : "";
    if (!isExpoPushToken(token)) return;
    cachedPushToken = token;
    void AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    onToken(token);
  });
  return () => sub.remove();
}

/** OS permission only — does not trigger a permission request. */
export async function getNotificationPermissionGranted(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/** Request system notification permission (explicit user action, e.g. nudge). */
export async function requestNotificationPermissionFromUser(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** Dev / QA: trigger Laravel push for the signed-in phone number. */
export async function sendTestPushViaBackend(phone_number: string): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!BASE_URL) {
    return { ok: false, message: "EXPO_PUBLIC_API_URL is not set" };
  }
  const phone = phone_number.trim();
  if (!phone) {
    return { ok: false, message: "No phone number on user" };
  }

  try {
    const response = await request.postJson(
      {
        to: "phone",
        title: "HeySolana test",
        body: "Remote push test from dev tools",
        phone_number: phone,
        data: { type: "test" },
      },
      "/notifications/send"
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        typeof body?.message === "string"
          ? body.message
          : `HTTP ${response.status}`;
      return { ok: false, message: msg };
    }
    const count = body?.sent_count ?? "?";
    return { ok: true, message: `Sent to ${count} device(s)` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Request failed",
    };
  }
}
