import { SplashScreen, Stack } from "expo-router";
import "../global.css";
import { useEffect } from "react";
export default function RootLayout() {
  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync(); // Prevent auto-hide
        // Simulate loading
        setTimeout(() => {
          SplashScreen.hideAsync(); // Hide manually after some time
        }, 2000);
      } catch (e) {
        console.warn(e);
      }
    }
    prepare();
  }, []);


  return <Stack
    screenOptions={
      {
        headerShown: false,
        statusBarStyle: "dark",
        statusBarBackgroundColor: "#f3f3f3",
      }
    }

  >
    <Stack.Screen name="index" options={{ title: 'Home' }} />
    <Stack.Screen name="aisetup" options={{ title: 'Setup' }} />
  </Stack>
}
