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
    registeringRef.current = true;
    try {
      await registerPushTokenWithBackend({ phone_number: mobileNumber.trim() });
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
      const phone = UserItem.getState().user?.mobileNumber;
      if (phone) void syncTokenForUser(phone);
    });

    const receivedSub = Notifications.addNotificationReceivedListener((event) => {
      const data = event.notification.request.content.data as Record<string, unknown>;
      if (AppSettings.getState().notifications && data?.preview_in_app !== false) {
        const body = event.notification.request.content.body;
        if (body) {
          AppSettings.getState().setToast(String(body).slice(0, 200), "info");
        }
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        routeFromNotificationData(data);
      }
    );

    return () => {
      unsubUser();
      unsubToken();
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return <>{children}</>;
};
