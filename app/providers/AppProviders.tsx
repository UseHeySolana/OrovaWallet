import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { KeyboardProvider } from "@/context/KeyboardContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AiServiceProvider } from "@/context/AiContext";
import { PIPManager } from "@/services/PIPService/PIPManager";
import PIPDeepLinkHandler from "@/services/PIPService/PIPDeepLinkHandler";
import { WidgetManager } from "@/services/WidgetService/WidgetManager";
import { PushNotificationManager } from "@/services/push/PushNotificationManager";
import { PajCashBeneficiariesManager } from "@/services/pajcash/PajCashBeneficiariesManager";
import { PajCashSessionManager } from "@/services/pajcash/PajCashSessionManager";
import { NotificationPermissionNudge } from "@/services/push/NotificationPermissionNudge";
import { GoogleDriveBackupNudge } from "@/services/account/GoogleDriveBackupNudge";
import WhatsAppCampaignTracker from "@/services/whatsapp/WhatsAppCampaignTracker";
import StackView from "../stack";

/**
 * Root provider tree for the app shell.
 * Keep bootstrap side-effects in `useRootBootstrap` / `_layout.tsx`, not here.
 */
export function AppProviders() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <KeyboardProvider>
            <ThemeProvider>
              <AiServiceProvider>
                <PIPManager>
                  <PIPDeepLinkHandler />
                  <WhatsAppCampaignTracker />
                  <PushNotificationManager>
                    <PajCashBeneficiariesManager>
                      <PajCashSessionManager>
                        <NotificationPermissionNudge />
                        <GoogleDriveBackupNudge />
                        <WidgetManager>
                          <StackView />
                        </WidgetManager>
                      </PajCashSessionManager>
                    </PajCashBeneficiariesManager>
                  </PushNotificationManager>
                </PIPManager>
              </AiServiceProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
