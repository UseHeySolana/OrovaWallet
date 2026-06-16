import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import HeyText from "@/components/TextComp";
import tracker from "@/utils/tracker";
import { useThemeContext } from "@/context/ThemeContext";
import { ACTIVE_PROMO, type PromoCampaign } from "@/utils/promo/promoConfig";
import { getActivePromoNudge } from "@/services/promo/promoApi";

const STORAGE_PREFIX = "@heysolana/promo_dismissed_";

const INITIAL_DELAY_MS = __DEV__ ? 1200 : 2800;
const CARD_RADIUS = 30;

async function isPromoDismissed(promoId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(`${STORAGE_PREFIX}${promoId}`);
  return value === "1";
}

async function markPromoDismissed(promoId: string): Promise<void> {
  await AsyncStorage.setItem(`${STORAGE_PREFIX}${promoId}`, "1");
}

interface PromoNotificationModalProps {
  /** When true, the promo will not be shown (e.g. PIN setup sheet is open). */
  blocked?: boolean;
}

/**
 * In-app promotional modal shown on the dashboard, similar to fintech promo popups.
 * Content is driven by {@link ACTIVE_PROMO} in utils/promo/promoConfig.ts.
 */
export function PromoNotificationModal({ blocked = false }: PromoNotificationModalProps) {
  const { isDarkMode } = useThemeContext();
  const [promo, setPromo] = useState<PromoCampaign | null>(null);
  const [promoLoaded, setPromoLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const imageSource =
    typeof promo?.image === "string" ? { uri: promo.image } : promo?.image;
  const hasImage = Boolean(imageSource);
  const hasCta = Boolean(promo?.ctaLabel && promo?.action);
  const colors = {
    card: isDarkMode ? "#131313" : "#FFFFFF",
    cardBorder: isDarkMode ? "#2C2C2C" : "#EEF2F2",
    fallbackHeader: isDarkMode ? "#242424" : "#F1FFFA",
    headline: isDarkMode ? "#FFFFFF" : "#0C0C0C",
    muted: isDarkMode ? "#D1D5DB" : "#6B7280",
    closeBg: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.20)",
    closeBorder: isDarkMode ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.55)",
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const remotePromo = await getActivePromoNudge();
        if (!cancelled) {
          setPromo(remotePromo);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[promo] failed to fetch active nudge; using local fallback", error);
        }
        if (!cancelled) {
          setPromo(ACTIVE_PROMO);
        }
      } finally {
        if (!cancelled) {
          setPromoLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const dismiss = useCallback(async () => {
    if (promo) {
      await markPromoDismissed(promo.id);
      tracker.buttons(`promo_dismiss_${promo.id}`, 1);
    }
    close();
  }, [close, promo]);

  const evaluate = useCallback(async () => {
    if (!mountedRef.current || blocked || !promoLoaded) {
      setVisible(false);
      return;
    }
    if (!promo?.enabled) {
      setVisible(false);
      return;
    }
    if (await isPromoDismissed(promo.id)) {
      setVisible(false);
      return;
    }
    setVisible(true);
    tracker.buttons(`promo_shown_${promo.id}`, 1);
  }, [blocked, promo, promoLoaded]);

  const scheduleShow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void evaluate();
    }, INITIAL_DELAY_MS);
  }, [evaluate]);

  useEffect(() => {
    mountedRef.current = true;
    if (promoLoaded) {
      scheduleShow();
    }
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [promoLoaded, scheduleShow]);

  useEffect(() => {
    if (blocked && visible) {
      close();
      return;
    }
    if (!blocked && promoLoaded && promo?.enabled) {
      scheduleShow();
    }
  }, [blocked, close, promo?.enabled, promoLoaded, scheduleShow, visible]);

  const onCtaPress = useCallback(async () => {
    if (!promo?.action) return;
    tracker.buttons(`promo_cta_${promo.id}`, 1);
    await markPromoDismissed(promo.id);
    close();

    if (promo.action.type === "route") {
      router.push(promo.action.path as never);
      return;
    }
    await Linking.openURL(promo.action.url);
  }, [close, promo]);

  if (!promo?.enabled) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Pressable
        onPress={dismiss}
        className="flex-1 justify-center items-center px-5"
        style={{ backgroundColor: "rgba(0,0,0,0.62)" }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          className="w-full"
          style={{ maxWidth: 350 }}
        >
          <View
            className="shadow-lg border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderRadius: CARD_RADIUS,
              overflow: "hidden",
            }}
          >
            {hasImage ? (
              <Image
                source={imageSource}
                style={{
                  width: "100%",
                  height: 190,
                  borderTopLeftRadius: CARD_RADIUS,
                  borderTopRightRadius: CARD_RADIUS,
                }}
                contentFit="cover"
              />
            ) : (
              <View
                className="items-center px-6 pt-8 pb-2"
                style={{
                  backgroundColor: colors.fallbackHeader,
                  borderTopLeftRadius: CARD_RADIUS,
                  borderTopRightRadius: CARD_RADIUS,
                }}
              >
                <View className="h-20 w-20 rounded-full bg-[#1BB296]/15 items-center justify-center">
                  <View className="h-14 w-14 rounded-full bg-[#1BB296] items-center justify-center">
                    <Feather name="gift" size={26} color="#ffffff" />
                  </View>
                </View>
              </View>
            )}

            <View className={`px-6 pb-6 items-center ${hasImage ? "pt-5" : "pt-4"}`}>
              <HeyText
                style={{ fontFamily: "bold", color: colors.headline }}
                className="text-center text-[20px] leading-7 pt-3"
              >
                {promo.headline}
              </HeyText>

              {promo.highlight ? (
                <HeyText
                  style={{ fontFamily: "bold" }}
                  className="text-center text-[20px] leading-9 text-[#1BB296] mb-3"
                >
                  {promo.highlight}
                </HeyText>
              ) : null}

              {promo.body ? (
                <HeyText
                  style={{ color: colors.muted }}
                  className="text-center text-[0.95rem] leading-5 mb-6"
                >
                  {promo.body}
                </HeyText>
              ) : (
                <View className="mb-5" />
              )}

              {hasCta ? (
                <Pressable
                  onPress={onCtaPress}
                  className="w-full rounded-full bg-purple py-4 items-center active:opacity-90"
                >
                  <HeyText className="text-white" style={{ fontFamily: "bold" }}>
                    {promo.ctaLabel}
                  </HeyText>
                </Pressable>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={dismiss}
            accessibilityLabel="Close promotion"
            className="mt-4 self-center h-11 w-11 rounded-full border items-center justify-center active:opacity-80"
            style={{
              backgroundColor: colors.closeBg,
              borderColor: colors.closeBorder,
            }}
          >
            <Feather name="x" size={22} color="#ffffff" />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
