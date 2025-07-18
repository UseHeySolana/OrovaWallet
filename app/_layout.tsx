import React, { useState } from 'react';
import '../global.css'
import { SplashScreen, Stack, useNavigationContainerRef, useRootNavigationState } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { DMSans_400Regular, DMSans_700Bold, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View } from 'react-native';
import { Image } from 'expo-image';
import { AiServiceProvider } from '@/misc/context/AiContext';
import { KeyboardProvider } from '@/misc/context/KeyboardContext';
import { PIPManager } from "@/components/PIPService/PIPManager";
import { WidgetManager } from "@/components/WidgetService/WidgetManager";

import { ThemeProvider, useThemeContext } from "@/misc/context/ThemeContext";
import StackView from "./stack";
import { useRouteTracking } from "@/components/hooks/navigation";
import tracker from "@/misc/helpers/db/tracker";
import * as Linking from "expo-linking";
import PIPDeepLinkHandler from "@/components/PIPService/PIPDeepLinkHandler";

SplashScreen.preventAutoHideAsync(); // Prevent auto-hide

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

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
    <GestureHandlerRootView>
      <KeyboardProvider>
        <ThemeProvider>
          <AiServiceProvider>
            <PIPManager>
              <PIPDeepLinkHandler />
              <WidgetManager>
                <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
                  <StackView />
                </SafeAreaView>
              </WidgetManager>
            </PIPManager>
          </AiServiceProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}


