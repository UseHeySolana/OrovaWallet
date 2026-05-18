import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";

import CText from "@/components/TextComp";
import UserItem from "@/utils/store/userstore.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { phoneForPushApi } from "@/utils/phone/phoneE164";
import {
  getCachedExpoPushToken,
  getNotificationPermissionGranted,
  registerPushTokenWithBackend,
  resolveExpoPushToken,
  sendTestPushViaBackend,
} from "@/services/push/pushNotifications";

/**
 * Dev-only controls on Settings for push token copy, re-register, and backend test send.
 */
export function PushNotificationDevTools() {
  const { user } = UserItem();
  const { setToast } = AppSettings();
  const [busy, setBusy] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | null>(
    () => getCachedExpoPushToken()
  );

  const refreshToken = useCallback(async () => {
    setBusy(true);
    try {
      const token = await resolveExpoPushToken();
      setTokenPreview(token);
      if (!token) {
        setToast("No push token (permission denied or use a dev build on device)", "error");
        return null;
      }
      return token;
    } finally {
      setBusy(false);
    }
  }, [setToast]);

  const onCopyToken = useCallback(async () => {
    const token = (await refreshToken()) ?? getCachedExpoPushToken();
    if (!token) return;
    await Clipboard.setStringAsync(token);
    setToast("Push token copied", "success");
  }, [refreshToken, setToast]);

  const onRegister = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await registerPushTokenWithBackend({ user });
      if (ok) {
        setTokenPreview(getCachedExpoPushToken());
        setToast("Token registered with backend", "success");
      } else {
        const granted = await getNotificationPermissionGranted();
        setToast(
          granted
            ? "Register failed — check EXPO_PUBLIC_API_URL and Laravel logs"
            : "Grant notification permission first",
          "error"
        );
      }
    } finally {
      setBusy(false);
    }
  }, [user, setToast]);

  const onSendTest = useCallback(async () => {
    const phone = phoneForPushApi(user ?? null);
    if (!phone) {
      setToast("Log in with a phone number to send a targeted test", "error");
      return;
    }
    setBusy(true);
    try {
      await refreshToken();
      const result = await sendTestPushViaBackend(phone);
      setToast(result.message, result.ok ? "success" : "error");
    } finally {
      setBusy(false);
    }
  }, [user, refreshToken, setToast]);

  const shortToken =
    tokenPreview && tokenPreview.length > 28
      ? `${tokenPreview.slice(0, 22)}…`
      : tokenPreview ?? "—";

  return (
    <View className="mt-4 pt-4 border-t border-grey/20">
      <CText style={{ fontFamily: "bold" }} className="text-[0.95rem] mb-1">
        Push notifications
      </CText>
      <CText className="text-[0.75rem] opacity-60 mb-3" numberOfLines={2}>
        Token: {shortToken}
      </CText>
      <View className="gap-y-2">
        <DevButton label="Copy push token" onPress={onCopyToken} disabled={busy} />
        <DevButton label="Re-register with API" onPress={onRegister} disabled={busy} />
        <DevButton
          label="Send test push (this phone)"
          onPress={onSendTest}
          disabled={busy}
          primary
        />
      </View>
      {busy ? (
        <ActivityIndicator className="mt-3" color="#971BB2" />
      ) : null}
      <CText className="text-[0.7rem] opacity-50 mt-2 text-center">
        Background the app after send to see the system notification
      </CText>
    </View>
  );
}

function DevButton({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`py-2.5 px-4 rounded-xl items-center active:opacity-90 ${
        primary ? "bg-purple" : "bg-grey/20 dark:bg-white/10"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <CText className={primary ? "text-white text-[0.9rem]" : "text-[0.9rem]"}>
        {label}
      </CText>
    </Pressable>
  );
}
