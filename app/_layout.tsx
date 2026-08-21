import React, { useEffect, useState } from "react";
import "../global.css";
import { SplashScreen } from "expo-router";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_700Bold,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";
import { View } from "react-native";
import { Image } from "expo-image";
import { configureGoogleSignIn } from "@/services/google/googleAuth";
import { useRouteTracking } from "@/components/hooks/navigation";
import tracker from "@/utils/tracker";
import { initBugReporting } from "@/services/bugReport/initBugReporting";
import { useRootBootstrap } from "@/hooks/useRootBootstrap";
import { AppProviders } from "./providers/AppProviders";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  const [loaded, error] = useFonts({
    reg: DMSans_400Regular,
    md: DMSans_500Medium,
    bold: DMSans_700Bold,
  });

  useRouteTracking((routeName: string) => {
    tracker.page_open_count(routeName, 1);
  });

  useEffect(() => {
    async function prepare() {
      try {
        // Brief delay so the animated splash gif can paint before hide.
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.warn(e);
      } finally {
        if (loaded) {
          setAppReady(true);
          SplashScreen.hideAsync();
        }
      }
    }
    prepare();
  }, [loaded, error]);

  useEffect(() => {
    initBugReporting();
    configureGoogleSignIn();
  }, []);

  useRootBootstrap(appReady);

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

  return <AppProviders />;
}
