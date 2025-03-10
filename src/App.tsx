
import React, { useState } from 'react';
import { SplashScreen } from "expo-router";
import "../global.css";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import { DMSans_400Regular, DMSans_700Bold, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from 'react-native-safe-area-context';

import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { View } from 'react-native';
import { Image } from 'expo-image';


SplashScreen.preventAutoHideAsync(); // Prevent auto-hide


export default function App() {
  const [appReady, setAppReady] = useState(false);
    const [loaded, error] = useFonts({
        reg: DMSans_400Regular,
        md: DMSans_500Medium,
        bold: DMSans_700Bold,
      });
    
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
        <Image source={require('@/src/assets/images/splaash.gif')}
          style={{ height: 100, width: 100 }}
          contentFit="contain"
        />
      </View>
    );
  }
    
  return (
    <NavigationContainer>
         <GestureHandlerRootView>
          <SafeAreaView style={{ flex: 1 }}>
            <AppNavigator />
          </SafeAreaView>
      </GestureHandlerRootView>
    </NavigationContainer>
  );
}