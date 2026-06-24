import { BASE_URL } from "@/utils/constant";
import { Platform } from "react-native";
import { getTrackingUserKey } from "@/utils/tracker";
import WalletItem from "@/utils/store/wallet.store";

export async function reportWhatsAppCampaignEvent(
  campaignKey: string,
  eventType: "link_clicked" = "link_clicked"
): Promise<boolean> {
  if (!BASE_URL || !campaignKey.trim()) return false;

  try {
    const wallet = WalletItem.getState();
    const walletAddress = wallet.publicKeyBase58 ?? wallet.publicKey?.toBase58();
    const res = await fetch(
      `${BASE_URL}/whatsapp-campaigns/${encodeURIComponent(campaignKey)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          user_key: await getTrackingUserKey(),
          wallet_address: walletAddress ?? null,
          device_type: Platform.OS,
        }),
      }
    );

    return res.ok;
  } catch (error) {
    if (__DEV__) {
      console.warn("[whatsapp] failed to report campaign event", eventType, error);
    }
    return false;
  }
}

export function extractWhatsAppCampaignKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("wa_campaign");
  } catch {
    const match = url.match(/[?&]wa_campaign=([^&]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}
