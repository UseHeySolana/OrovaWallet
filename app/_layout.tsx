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
import { AiServiceProvider } from '@/misc/context/AiContext';
import { ThemeProvider, useThemeContext } from '@/misc/context/ThemeContext';
import StackView from './stack';


SplashScreen.preventAutoHideAsync(); // Prevent auto-hide

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  const [loaded, error] = useFonts({
    reg: DMSans_400Regular,
    md: DMSans_500Medium,
    bold: DMSans_700Bold,
  });


  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading delay
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




  return (
    <GestureHandlerRootView>
      <ThemeProvider>
        <AiServiceProvider>
          <SafeAreaView style={{ flex: 1 }}>

            <StackView />
          </SafeAreaView>
        </AiServiceProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}


