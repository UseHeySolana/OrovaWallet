import React, { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import UserItem from "@/utils/store/userstore.store";
import AppSettings from "@/utils/store/settingsstore.store";
import {
  attachPushTokenRefreshListener,
  deactivatePushTokenOnBackend,
  registerPushTokenWithBackend,
} from "@/services/push/pushNotifications";
import { reportPushCampaignEvent } from "@/services/push/pushCampaignApi";

/** Remote/local payloads differ by platform; `notification.request` may be missing on Android. */
function getNotificationContent(
  notification: Notifications.Notification | undefined
): Notifications.NotificationContent | null {
  if (!notification) return null;
  return notification.request?.content ?? null;
}

function parseNotificationData(
  raw: unknown
): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function routeFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return;

  const action = data.action;
  if (action === "start_ai") {
    router.push("/dashboard");
    return;
  }
  if (action === "open_app" || action === "show_pip") {
    router.push("/dashboard");
    return;
  }

  const type = data.type;
  if (type === "wallet_balance" || type === "transaction") {
    router.push("/dashboard");
    return;
  }
  if (type === "scheduled_campaign" || type === "inactive_user_reminder") {
    const link = data.link;
    if (typeof link === "string" && link.startsWith("/")) {
      router.push(link as any);
      return;
    }
    router.push("/dashboard");
    return;
  }
  if (type === "push_campaign" || type === "admin_broadcast") {
    const campaignKey = data.campaign_key;
    if (typeof campaignKey === "string" && campaignKey.trim()) {
      void reportPushCampaignEvent(campaignKey, "opened");
    }
    const link = data.link;
    if (typeof link === "string" && link.startsWith("/")) {
      router.push(link as any);
      return;
    }
    router.push("/dashboard");
    return;
  }

  const link = data.link ?? data.url;
  if (typeof link === "string" && link.startsWith("/")) {
    router.push(link as any);
  }
}

type Props = {
  children: React.ReactNode;
};

/**
 * Registers Expo push tokens with the Laravel backend when a user is signed in,
 * deactivates on logout, and routes notification taps.
 */
export const PushNotificationManager: React.FC<Props> = ({ children }) => {
  const lastPhoneRef = useRef<string | null>(null);
  const registeringRef = useRef(false);

  const syncTokenForUser = async (mobileNumber: string | undefined) => {
    if (!mobileNumber?.trim() || registeringRef.current) return;
    if (!AppSettings.getState().notifications) return;
    registeringRef.current = true;
    try {
      await registerPushTokenWithBackend({
        phone_number: mobileNumber.trim(),
        user: UserItem.getState().user,
      });
    } finally {
      registeringRef.current = false;
    }
  };

  useEffect(() => {
    const user = UserItem.getState().user;
    if (user?.mobileNumber) {
      lastPhoneRef.current = user.mobileNumber;
      void syncTokenForUser(user.mobileNumber);
    }

    const unsubUser = UserItem.subscribe((state, prev) => {
      const phone = state.user?.mobileNumber?.trim() || null;
      const prevPhone = prev.user?.mobileNumber?.trim() || null;

      if (!state.user && prev.user) {
        lastPhoneRef.current = null;
        void deactivatePushTokenOnBackend();
        return;
      }

      if (phone && phone !== prevPhone && phone !== lastPhoneRef.current) {
        lastPhoneRef.current = phone;
        void syncTokenForUser(phone);
      }
    });

    const unsubToken = attachPushTokenRefreshListener(() => {
      if (!AppSettings.getState().notifications) return;
      const phone = UserItem.getState().user?.mobileNumber;
      if (phone) void syncTokenForUser(phone);
    });

    const receivedSub = Notifications.addNotificationReceivedListener((event) => {
      try {
        const content = getNotificationContent(event.notification);
        if (!content) return;

        const data = parseNotificationData(content.data);
        if (AppSettings.getState().notifications && data?.preview_in_app !== false) {
          const body = content.body;
          if (body) {
            AppSettings.getState().setToast(String(body).slice(0, 200), "info");
          }
        }
      } catch (err) {
        console.warn("[push] notification received handler:", err);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        try {
          const content = getNotificationContent(response.notification);
          routeFromNotificationData(parseNotificationData(content?.data));
        } catch (err) {
          console.warn("[push] notification response handler:", err);
        }
      }
    );

    const unsubSettings = AppSettings.subscribe((state, prev) => {
      if (state.notifications === prev.notifications) return;
      const phone = UserItem.getState().user?.mobileNumber?.trim();
      if (!state.notifications) {
        void deactivatePushTokenOnBackend();
      } else if (phone) {
        void syncTokenForUser(phone);
      }
    });

    return () => {
      unsubUser();
      unsubSettings();
      unsubToken();
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return <>{children}</>;
};
