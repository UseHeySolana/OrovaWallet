import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";

import CText from "@/components/TextComp";
import UserItem from "@/utils/store/userstore.store";
import { userMissingBackupEmail } from "@/utils/account/emailSetup";
import { useThemeContext } from "@/context/ThemeContext";

const STORAGE_DONT_ASK = "@heysolana/email_setup_nudge_dont_ask";
const STORAGE_LAST_SHOWN = "@heysolana/email_setup_nudge_last_shown_at";

const REPEAT_INTERVAL_MS = __DEV__ ? 90 * 1000 : 7 * 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = __DEV__ ? 1500 : 3200;
const CARD_RADIUS = 28;

const BENEFITS = [
  {
    key: "recover",
    title: "Recover your account",
    body: "Easily restore access if you ever need to.",
    Icon: (color: string) => (
      <MaterialIcons name="security" size={18} color={color} />
    ),
  },
  {
    key: "updates",
    title: "Stay informed",
    body: "Get important updates and alerts.",
    Icon: (color: string) => (
      <Ionicons name="notifications-outline" size={18} color={color} />
    ),
  },
  {
    key: "secure",
    title: "More secure",
    body: "Add an extra layer of protection.",
    Icon: (color: string) => <Feather name="lock" size={17} color={color} />,
  },
] as const;

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

function BenefitRow({
  title,
  body,
  Icon,
  iconBg,
  iconColor,
  titleColor,
  bodyColor,
}: {
  title: string;
  body: string;
  Icon: (color: string) => React.ReactNode;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  bodyColor: string;
}) {
  return (
    <View className="flex-row items-start gap-x-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        {Icon(iconColor)}
      </View>
      <View className="flex-1 pt-0.5">
        <CText style={{ fontFamily: "bold", color: titleColor }} className="text-[0.95rem]">
          {title}
        </CText>
        <CText style={{ color: bodyColor }} className="text-[0.82rem] leading-5 mt-0.5">
          {body}
        </CText>
      </View>
    </View>
  );
}

/**
 * Prompts phone-only users to add a backup email for recovery and account security.
 */
export function EmailSetupNudge() {
  const { isDarkMode } = useThemeContext();
  const pathname = usePathname();
  const user = UserItem((state) => state.user);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const colors = {
    card: isDarkMode ? "#131313" : "#FFFFFF",
    cardBorder: isDarkMode ? "#2C2C2C" : "#EEF2F2",
    heroBg: isDarkMode ? "#1E1428" : "#F7F2FF",
    headline: isDarkMode ? "#FFFFFF" : "#111111",
    muted: isDarkMode ? "#B8B8B8" : "#6B7280",
    benefitIconBg: isDarkMode ? "rgba(151,27,178,0.18)" : "#F3E8FF",
    benefitIcon: "#971BB2",
    divider: isDarkMode ? "#3A3A3A" : "#E5E7EB",
    close: isDarkMode ? "#9CA3AF" : "#9CA3AF",
  };

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
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 justify-center items-center px-5"
        style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        onPress={onNotNow}
      >
        <Pressable
          className="w-full"
          style={{ maxWidth: 380 }}
          onPress={(event) => event.stopPropagation()}
        >
          <View
            className="border shadow-lg overflow-hidden"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderRadius: CARD_RADIUS,
            }}
          >
            <Pressable
              onPress={onNotNow}
              accessibilityLabel="Close"
              className="absolute right-4 top-4 z-10 h-8 w-8 items-center justify-center"
            >
              <Feather name="x" size={22} color={colors.close} />
            </Pressable>

            <View
              className="items-center justify-center px-6 pt-8 pb-4"
              style={{ backgroundColor: colors.heroBg }}
            >
              <Image
                source={require("@/assets/icon/email-icon.png")}
                style={{ width: 220, height: 220 }}
                contentFit="contain"
              />
            </View>

            <View className="px-6 pt-5 pb-6">
              <View className="items-center mb-4">
                <View
                  className="h-11 w-11 items-center justify-center rounded-2xl mb-3"
                  style={{ backgroundColor: colors.benefitIconBg }}
                >
                  <MaterialIcons name="mail-outline" size={22} color={colors.benefitIcon} />
                </View>
                <CText
                  style={{ fontFamily: "bold", color: colors.headline }}
                  className="text-center text-[1.35rem] leading-8"
                >
                  Add a backup email
                </CText>
                <CText
                  style={{ color: colors.muted }}
                  className="text-center text-[0.9rem] leading-5 mt-2"
                >
                  Secure your wallet with a backup email for recovery and important account
                  updates. It only takes a minute.
                </CText>
              </View>

              <View className="gap-y-4 mb-6">
                {BENEFITS.map((benefit) => (
                  <BenefitRow
                    key={benefit.key}
                    title={benefit.title}
                    body={benefit.body}
                    Icon={benefit.Icon}
                    iconBg={colors.benefitIconBg}
                    iconColor={colors.benefitIcon}
                    titleColor={colors.headline}
                    bodyColor={colors.muted}
                  />
                ))}
              </View>

              <Pressable
                onPress={onAddEmail}
                className="rounded-full bg-purple py-4 flex-row items-center justify-center gap-x-2 active:opacity-90"
              >
                <CText className="text-white text-[1rem]" style={{ fontFamily: "bold" }}>
                  Set up email
                </CText>
                <Feather name="arrow-right" size={18} color="#ffffff" />
              </Pressable>

              <View className="flex-row items-center justify-center mt-5 gap-x-4">
                <Pressable onPress={onNotNow} className="py-2">
                  <CText className="text-purple text-[0.9rem]" style={{ fontFamily: "md" }}>
                    Not now
                  </CText>
                </Pressable>
                <View
                  style={{
                    width: 1,
                    height: 16,
                    backgroundColor: colors.divider,
                  }}
                />
                <Pressable onPress={onDontAsk} className="py-2">
                  <CText style={{ color: colors.muted }} className="text-[0.9rem]">
                    {"Don't ask again"}
                  </CText>
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
