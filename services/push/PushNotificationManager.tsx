import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import UserItem from "@/utils/store/userstore.store";
import type { UserType } from "@/utils/types/user.types";
import AppSettings from "@/utils/store/settingsstore.store";
import { waitForPersistStore } from "@/utils/store/waitForPersist";
import type { StoreWithPersist } from "@/utils/store/waitForPersist";
import {
  attachPushTokenRefreshListener,
  canRegisterPushForUser,
  deactivatePushTokenOnBackend,
  pushRegistrationIdentityKey,
  registerPushTokenWithBackend,
} from "@/services/push/pushNotifications";
import { reportPushCampaignEvent } from "@/services/push/pushCampaignApi";
import {
  parseSupportConversationId,
  setPendingSupportConversationId,
} from "@/services/supportPushNavigation";

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
  if (type === "support_reply") {
    const conversationId = parseSupportConversationId(data);
    if (conversationId != null) {
      setPendingSupportConversationId(conversationId);
    }
    const link = data.link;
    if (typeof link === "string" && link.startsWith("/")) {
      router.push(link as any);
      return;
    }
    router.push("/settings/support");
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
  const lastIdentityRef = useRef<string | null>(null);
  const registeringRef = useRef(false);

  const syncTokenForUser = async (
    user: UserType | null | undefined,
    options?: { force?: boolean }
  ) => {
    if (!user || !canRegisterPushForUser(user) || registeringRef.current) return;
    if (!AppSettings.getState().notifications) return;

    const identity = pushRegistrationIdentityKey({ user });
    if (!options?.force && identity === lastIdentityRef.current) return;

    registeringRef.current = true;
    try {
      const ok = await registerPushTokenWithBackend({ user });
      if (ok && identity) {
        lastIdentityRef.current = identity;
      }
    } finally {
      registeringRef.current = false;
    }
  };

  const bootstrapPushRegistration = () => {
    const user = UserItem.getState().user;
    if (!user || !AppSettings.getState().notifications) return;
    void syncTokenForUser(user, { force: true });
  };

  useEffect(() => {
    void (async () => {
      await Promise.all([
        waitForPersistStore(UserItem as unknown as StoreWithPersist),
        waitForPersistStore(AppSettings as unknown as StoreWithPersist),
      ]);
      bootstrapPushRegistration();
    })();

    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        bootstrapPushRegistration();
      }
    });

    const unsubUser = UserItem.subscribe((state, prev) => {
      if (!state.user && prev.user) {
        lastIdentityRef.current = null;
        void deactivatePushTokenOnBackend();
        return;
      }

      if (!state.user || !AppSettings.getState().notifications) return;

      const identity = pushRegistrationIdentityKey({ user: state.user });
      const prevIdentity = pushRegistrationIdentityKey({ user: prev.user });
      if (!prev.user || identity !== prevIdentity) {
        void syncTokenForUser(state.user, { force: true });
      }
    });

    const unsubToken = attachPushTokenRefreshListener(() => {
      if (!AppSettings.getState().notifications) return;
      const user = UserItem.getState().user;
      if (user) void syncTokenForUser(user, { force: true });
    });

    const receivedSub = Notifications.addNotificationReceivedListener((event) => {
      try {
        const content = getNotificationContent(event.notification);
        if (!content) return;

        const data = parseNotificationData(content.data);
        if (data?.type === "support_reply") {
          const conversationId = parseSupportConversationId(data);
          if (conversationId != null) {
            setPendingSupportConversationId(conversationId);
          }
        }
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
      const user = UserItem.getState().user;
      if (!state.notifications) {
        lastIdentityRef.current = null;
        void deactivatePushTokenOnBackend();
      } else if (user) {
        void syncTokenForUser(user, { force: true });
      }
    });

    return () => {
      appStateSub.remove();
      unsubUser();
      unsubSettings();
      unsubToken();
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return <>{children}</>;
};
