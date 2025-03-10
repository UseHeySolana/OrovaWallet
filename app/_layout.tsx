import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import '../global.css'
import { useEffect } from "react";
export default function RootLayout() {
  useEffect(() => {

  }, [])
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          statusBarStyle: 'dark',
          statusBarBackgroundColor: "#f3f3f3",
        }}
      >
      </Stack>
    </SafeAreaView>);
}
