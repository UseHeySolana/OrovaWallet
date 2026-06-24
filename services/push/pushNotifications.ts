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

let cachedPushToken: string | null = null;
let permissionRequested = false;

function getEasProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

export function getCachedExpoPushToken(): string | null {
  return cachedPushToken;
}

export async function ensurePushPermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "HeySolana",
      importance: Notifications.AndroidImportance.DEFAULT,
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

export async function resolveExpoPushToken(): Promise<string | null> {
  const granted = await ensurePushPermissions();
  if (!granted) return null;

  const projectId = getEasProjectId();
  if (!projectId) {
    console.warn("[push] Missing EAS projectId in app config");
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!data) return null;
    cachedPushToken = data;
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, data);
    return data;
  } catch (err) {
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

export async function registerPushTokenWithBackend(
  params: RegisterPushTokenParams = {}
): Promise<boolean> {
  if (!BASE_URL) {
    console.warn("[push] EXPO_PUBLIC_API_URL not set; skipping token registration");
    return false;
  }

  const pushToken = await resolveExpoPushToken();
  if (!pushToken) return false;

  const deviceType = Platform.OS === "ios" ? "ios" : "android";
  const body: Record<string, string | number> = {
    push_token: pushToken,
    device_type: deviceType,
  };
  const phone = resolvePhoneForPushRegistration(params);
  if (phone) body.phone_number = phone;
  if (params.user_id != null) body.user_id = params.user_id;
  const wallet = params.user?.wallet_address?.trim();
  if (wallet) body.wallet_address = wallet;

  try {
    const response = await request.postJson(body, "/notifications/register-token");
    if (!response.ok) {
      const text = await response.text();
      console.warn("[push] register-token failed:", response.status, text);
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
    if (!data) return;
    cachedPushToken = data;
    void AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, data);
    onToken(data);
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
