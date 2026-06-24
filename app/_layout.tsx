import React, { useEffect, useState } from 'react';
import '../global.css'
import { SplashScreen } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { DMSans_400Regular, DMSans_700Bold, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { View, AppState } from 'react-native';
import { Image } from 'expo-image';
import { AiServiceProvider } from "@/context/AiContext";
import { KeyboardProvider } from "@/context/KeyboardContext";
import { PIPManager } from "@/services/PIPService/PIPManager";
import { WidgetManager } from "@/services/WidgetService/WidgetManager";
import { PushNotificationManager } from "@/services/push/PushNotificationManager";
import { PajCashBeneficiariesManager } from "@/services/pajcash/PajCashBeneficiariesManager";
import { NotificationPermissionNudge } from "@/services/push/NotificationPermissionNudge";

import { ThemeProvider } from "@/context/ThemeContext";
import StackView from "./stack";
import { useRouteTracking } from "@/components/hooks/navigation";
import tracker from "@/utils/tracker";
import PIPDeepLinkHandler from "@/components/PIPService/PIPDeepLinkHandler";
import WhatsAppCampaignTracker from "@/services/whatsapp/WhatsAppCampaignTracker";
import { Brain } from "@/libs/brain";
import { initWallet } from "@/utils/wallet/initWallet";
import { bootstrapVerifiedTokensList } from "@/utils/functions";
import { initBugReporting } from "@/services/bugReport/initBugReporting";
import { syncPendingAppTransactions } from "@/services/appTransactions";

SplashScreen.preventAutoHideAsync(); // Prevent auto-hide

const brain = new Brain({
  notificationsEnabled: true,
  // llmEnabled: backend Brain digest LLM. Or set EXPO_PUBLIC_BRAIN_SUGGESTIONS_LLM=true.
  llmEnabled: false,
  llmModel: "my-llm",
});

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const walletInitRanRef = React.useRef(false);

  const [loaded, error] = useFonts({
    reg: DMSans_400Regular,
    md: DMSans_500Medium,
    bold: DMSans_700Bold,
  });

  useRouteTracking((routeName: any) => {
    tracker.page_open_count(routeName, 1);
  });

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate loading delay
      } catch (e) {
        console.warn(e);
      } finally {
        if (loaded) {
          setAppReady(true);
          SplashScreen.hideAsync(); // Hide splash screen once everything is ready
        }
      }
    }
    prepare();
  }, [loaded, error]);

  useEffect(() => {
    initBugReporting();
  }, []);

  useEffect(() => {
    if (!appReady) return;

    // Hydrate wallet for *any* route (refresh/deeplink safe).
    if (!walletInitRanRef.current) {
      walletInitRanRef.current = true;
      initWallet().catch(() => {
        // non-fatal
      });
      bootstrapVerifiedTokensList();
    }

    // Start Brain once per app launch.
    if (!brain.isStarted()) {
      brain.start().catch(() => {
        // non-fatal
      });
    }

    void syncPendingAppTransactions();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncPendingAppTransactions();
      }
    });
    return () => subscription.remove();
  }, [appReady]);

  if (!loaded && !error) {
    return null;
  }

  if (!appReady) {
    return (
      <View
        className="bg-white"
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <Image
          source={require("@/assets/images/splaash.gif")}
          style={{ height: 100, width: 100 }}
          contentFit="contain"
        />
      </View>
    );
  }

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
                  <NotificationPermissionNudge />
                  <WidgetManager>
                    <StackView />
                  </WidgetManager>
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


