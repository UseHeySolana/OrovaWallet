import React, { useState } from 'react';
import '../global.css'
import { SplashScreen, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { DMSans_400Regular, DMSans_700Bold, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View } from 'react-native';
import { Image } from 'expo-image';
import AppSettings from '@/misc/store/settingsstore';
import { AiServiceProvider } from '@/misc/context/AiContext';
import IconLibrary from "@/misc/helpers/icons";
import CText from '@/components/TextComp';


SplashScreen.preventAutoHideAsync(); // Prevent auto-hide

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  const [loaded, error] = useFonts({
    reg: DMSans_400Regular,
    md: DMSans_500Medium,
    bold: DMSans_700Bold,
  });

  const { isLoading, toast } = AppSettings();
  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate loading delay
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
      <View className='bg-white' style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image source={require('@/assets/images/splaash.gif')}
          style={{ height: 100, width: 100 }}
          contentFit="contain"
        />
      </View>
    );
  }



  const LoadingScreen = () => (
    <View className='h-full absolute w-full z-50 bg-white/55 flex justify-center items-center '>
      <Image source={require('@/assets/images/splaash.gif')} alt="Security image" style={{ height: 70, width: 70 }} contentFit="contain" />
    </View>
  );

  const ToastModal = ({ type, message }: { type: "success" | "error" | "info"; message: string }) => {
    const bgClass =
      type === "success"
        ? "bg-green-400/15 border border-green-400"
        : type === "error"
          ? "bg-red-600/15 border border-red-600"
          : "bg-orange-400/15 border border-orange-400";

    const textClass =
      type === "success"
        ? "text-green-600"
        : type === "error"
          ? "text-red-600"
          : "text-orange-600";
    return (
      <View className="absolute top-3 px-4 bg-grey py-3 w-full flex items-center">
        <View className={`p-3 rounded-xl ${bgClass} w-full flex flex-row items-center`}>
          {type === "success" && <IconLibrary.check color="green" />}
          {type === "error" && <IconLibrary.error color="red" />}
          {type === "info" && <IconLibrary.info color="orange" />}
          <CText className={`ml-2 ${textClass} text-[18px]`} style={{ fontFamily: 'bold' }}>{message}</CText>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView>
      <AiServiceProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              statusBarStyle: 'dark',
              statusBarBackgroundColor: "#f3f3f3",
            }}
          >

          </Stack>

          {toast.show && <ToastModal type={toast.type} message={toast.message} />}
          {isLoading && <LoadingScreen />}

        </SafeAreaView>
      </AiServiceProvider>

    </GestureHandlerRootView>
  );
}


