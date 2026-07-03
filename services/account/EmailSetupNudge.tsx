import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, usePathname } from "expo-router";

import CText from "@/components/TextComp";
import UserItem from "@/utils/store/userstore.store";
import { userMissingBackupEmail } from "@/utils/account/emailSetup";

const STORAGE_DONT_ASK = "@heysolana/email_setup_nudge_dont_ask";
const STORAGE_LAST_SHOWN = "@heysolana/email_setup_nudge_last_shown_at";

const REPEAT_INTERVAL_MS = __DEV__ ? 90 * 1000 : 7 * 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = __DEV__ ? 1500 : 3200;

function isAuthenticatedRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/manageaccounts") ||
    pathname.startsWith("/aisetup")
  );
}

async function readDontAsk(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STORAGE_DONT_ASK);
  return value === "1";
}

async function readLastShown(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(STORAGE_LAST_SHOWN);
  if (raw == null || raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function shouldShowNudge(): Promise<boolean> {
  if (await readDontAsk()) return false;
  const lastShown = await readLastShown();
  if (lastShown == null) return true;
  return Date.now() - lastShown >= REPEAT_INTERVAL_MS;
}

async function markNudgeShown(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_LAST_SHOWN, String(Date.now()));
}

async function markDontAsk(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_DONT_ASK, "1");
}

/**
 * Prompts phone-only users to add a backup email for recovery and account security.
 */
export function EmailSetupNudge() {
  const pathname = usePathname();
  const user = UserItem((state) => state.user);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const evaluate = useCallback(async () => {
    if (!mountedRef.current) return;
    if (!isAuthenticatedRoute(pathname)) {
      setVisible(false);
      return;
    }
    if (!userMissingBackupEmail(user)) {
      setVisible(false);
      return;
    }
    if (!(await shouldShowNudge())) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [pathname, user]);

  const scheduleShow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void evaluate();
    }, INITIAL_DELAY_MS);
  }, [evaluate]);

  useEffect(() => {
    mountedRef.current = true;
    scheduleShow();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        scheduleShow();
      }
    });
    return () => {
      mountedRef.current = false;
      subscription.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleShow]);

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

  const onAddEmail = useCallback(async () => {
    await markNudgeShown();
    close();
    router.push("/dashboard/account");
  }, [close]);

  if (!userMissingBackupEmail(user)) {
    return null;
  }

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
          onPress={(event) => event.stopPropagation()}
        >
          <CText style={{ fontFamily: "bold" }} className="text-[1.25rem] mb-2">
            Add a backup email
          </CText>
          <CText textColor="text-gray-500 dark:text-gray-300" className="text-[0.95rem] mb-6">
            Secure your wallet with a backup email for recovery and important account
            updates. It only takes a minute.
          </CText>
          <View className="gap-y-3">
            <Pressable
              onPress={onAddEmail}
              className="rounded-xl bg-purple py-3.5 items-center active:opacity-90"
            >
              <CText className="text-white" style={{ fontFamily: "bold" }}>
                Set up email
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
