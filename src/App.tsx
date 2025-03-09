
import React from 'react';
import { SplashScreen } from "expo-router";
import "../global.css";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import { DMSans_400Regular, DMSans_700Bold, DMSans_500Medium } from "@expo-google-fonts/dm-sans";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from 'react-native-safe-area-context';

import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';


SplashScreen.preventAutoHideAsync(); // Prevent auto-hide


export default function App() {
    const [loaded, error] = useFonts({
        reg: DMSans_400Regular,
        md: DMSans_500Medium,
        bold: DMSans_700Bold,
      });
    
      useEffect(() => {
        async function prepare() {
          try {
            // Simulate loading
            if (loaded) {
              SplashScreen.hideAsync(); // Hide manually after some time
            }
          } catch (e) {
            console.warn(e);
          }
        }
        prepare();
      }, [loaded, error]);
    
      if (!loaded && !error) {
        return null;
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