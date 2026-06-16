import { BASE_URL } from "@/utils/constant";
import type { PromoCampaign } from "@/utils/promo/promoConfig";
import { Platform } from "react-native";
import { getTrackingUserKey } from "@/utils/tracker";
import WalletItem from "@/utils/store/wallet.store";

interface ActiveNudgeResponse {
  success?: boolean;
  data?: {
    id?: number;
    campaign_key?: string;
    enabled?: boolean;
    headline?: string;
    highlight?: string | null;
    body?: string | null;
    image?: string | null;
    ctaLabel?: string | null;
    action?: ({ type: "route"; path: string } | { type: "external"; url: string }) | null;
  } | null;
}

export async function getActivePromoNudge(): Promise<PromoCampaign | null> {
  if (!BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }

  const res = await fetch(`${BASE_URL}/notification-nudges/active`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const json = (await res.json().catch(() => ({}))) as ActiveNudgeResponse;

  if (!res.ok) {
    throw new Error("Failed to fetch active notification nudge");
  }

  const nudge = json.data;
  if (!nudge?.campaign_key || !nudge.headline || nudge.enabled === false) {
    return null;
  }

  return {
    id: nudge.campaign_key,
    enabled: true,
    image: nudge.image ?? undefined,
    headline: nudge.headline,
    highlight: nudge.highlight ?? undefined,
    body: nudge.body ?? undefined,
    ctaLabel: nudge.ctaLabel ?? undefined,
    action: nudge.action ?? undefined,
  };
}

export type PromoNudgeEventType = "shown" | "dismissed" | "cta_clicked";

export async function reportPromoNudgeEvent(
  campaignKey: string,
  eventType: PromoNudgeEventType
): Promise<boolean> {
  if (!BASE_URL) return false;

  try {
    const wallet = WalletItem.getState();
    const walletAddress = wallet.publicKeyBase58 ?? wallet.publicKey?.toBase58();
    const res = await fetch(`${BASE_URL}/notification-nudges/${encodeURIComponent(campaignKey)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        user_key: await getTrackingUserKey(),
        wallet_address: walletAddress ?? null,
        device_type: Platform.OS,
      }),
    });

    return res.ok;
  } catch (error) {
    if (__DEV__) {
      console.warn("[promo] failed to report nudge event", eventType, error);
    }
    return false;
  }
}
