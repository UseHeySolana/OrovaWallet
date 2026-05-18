import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import CText from "@/components/TextComp";
import UserItem from "@/utils/store/userstore.store";
import AppSettings from "@/utils/store/settingsstore.store";
import {
  getNotificationPermissionGranted,
  registerPushTokenWithBackend,
  requestNotificationPermissionFromUser,
} from "@/services/push/pushNotifications";

const STORAGE_DONT_ASK = "@heysolana/notification_nudge_dont_ask";
const STORAGE_LAST_SHOWN = "@heysolana/notification_nudge_last_shown_at";

/** First prompt shortly after launch; later prompts at this interval if still denied. */
const REPEAT_INTERVAL_MS = __DEV__ ? 90 * 1000 : 7 * 24 * 60 * 60 * 1000;

/** Delay after app becomes active before showing (avoids clashing with splash / first paint). */
const INITIAL_DELAY_MS = __DEV__ ? 1200 : 2800;

async function readDontAsk(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_DONT_ASK);
  return v === "1";
}

async function readLastShown(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(STORAGE_LAST_SHOWN);
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

async function shouldShowNudge(): Promise<boolean> {
  if (await readDontAsk()) return false;
  if (await getNotificationPermissionGranted()) return false;
  const last = await readLastShown();
  if (last == null) return true;
  return Date.now() - last >= REPEAT_INTERVAL_MS;
}

async function markNudgeShown(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_LAST_SHOWN, String(Date.now()));
}

async function markDontAsk(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_DONT_ASK, "1");
}

/**
 * Soft prompt to enable system notifications (and in-app toggle) on first eligible
 * open and again after {@link REPEAT_INTERVAL_MS} if permission is still not granted.
 */
export function NotificationPermissionNudge() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const evaluate = useCallback(async () => {
    if (!mountedRef.current) return;
    if (!(await shouldShowNudge())) {
      setVisible(false);
      return;
    }
    if (await getNotificationPermissionGranted()) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, []);

  const scheduleShow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void evaluate();
    }, INITIAL_DELAY_MS);
  }, [evaluate]);

  useEffect(() => {
    mountedRef.current = true;
    scheduleShow();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void (async () => {
          if (await getNotificationPermissionGranted()) {
            setVisible(false);
            return;
          }
          scheduleShow();
        })();
      }
    });
    return () => {
      mountedRef.current = false;
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleShow, evaluate]);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const onNotNow = useCallback(async () => {
    await markNudgeShown();
    close();
  }, [close]);

  const onDontAsk = useCallback(async () => {
    await markDontAsk();
    await markNudgeShown();
    close();
  }, [close]);

  const onEnable = useCallback(async () => {
    const granted = await requestNotificationPermissionFromUser();
    if (granted) {
      AppSettings.getState().updateNotifications(true);
      const phone = UserItem.getState().user?.mobileNumber?.trim();
      if (phone) {
        void registerPushTokenWithBackend({ phone_number: phone });
      }
      await markNudgeShown();
      close();
      return;
    }
    if (Platform.OS === "ios" || Platform.OS === "android") {
      await Linking.openSettings();
    }
    await markNudgeShown();
    close();
  }, [close]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onNotNow}
    >
      <Pressable
        className="flex-1 justify-center items-center bg-black/50 px-5"
        onPress={onNotNow}
      >
        <Pressable
          className="w-full max-w-md rounded-2xl bg-white dark:bg-accent p-6 shadow-lg"
          onPress={(e) => e.stopPropagation()}
        >
          <CText style={{ fontFamily: "bold" }} className="text-[1.25rem] mb-2">
            Turn on notifications?
          </CText>
          <CText textColor="text-gray-500 dark:text-gray-300" className="text-[0.95rem] mb-6">
            Get wallet activity alerts, price updates, and important messages when you are
            not in the app. You can change this anytime in Settings.
          </CText>
          <View className="gap-y-3">
            <Pressable
              onPress={onEnable}
              className="rounded-xl bg-purple py-3.5 items-center active:opacity-90"
            >
              <CText className="text-white" style={{ fontFamily: "bold" }}>
                Enable notifications
              </CText>
            </Pressable>
            <Pressable onPress={onNotNow} className="py-3 items-center">
              <CText textColor="text-gray-500">Not now</CText>
            </Pressable>
            <Pressable onPress={onDontAsk} className="py-2 items-center">
              <CText className="text-[0.85rem] text-gray-400">{"Don't ask again"}</CText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
