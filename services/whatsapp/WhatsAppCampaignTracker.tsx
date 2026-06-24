import { useEffect } from "react";
import * as Linking from "expo-linking";
import {
  extractWhatsAppCampaignKey,
  reportWhatsAppCampaignEvent,
} from "@/services/whatsapp/whatsappCampaignApi";

/** Tracks WhatsApp campaign link clicks when the app opens with ?wa_campaign= */
export default function WhatsAppCampaignTracker() {
  useEffect(() => {
    const trackUrl = (url: string | null) => {
      if (!url) return;
      const campaignKey = extractWhatsAppCampaignKey(url);
      if (campaignKey) {
        void reportWhatsAppCampaignEvent(campaignKey, "link_clicked");
      }
    };

    Linking.getInitialURL().then(trackUrl);
    const subscription = Linking.addEventListener("url", (event) => trackUrl(event.url));
    return () => subscription.remove();
  }, []);

  return null;
}
