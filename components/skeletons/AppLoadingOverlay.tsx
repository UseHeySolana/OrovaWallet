import { View } from "react-native";
import { Image } from "expo-image";

/** Full-screen overlay when `AppSettings.isLoading` is true (wallet sync, bootstrap, etc.). */
export function AppLoadingOverlay() {
  return (
    <View
      className="absolute left-0 right-0 top-0 bottom-0 z-[100] bg-white/75 dark:bg-black/65 justify-center items-center px-8"
      accessibilityViewIsModal
      accessibilityLabel="Loading"
      pointerEvents="auto"
    >
      <Image
        source={require("@/assets/images/splaash.gif")}
        style={{ height: 100, width: 100 }}
        contentFit="contain"
      />
    </View>
  );
}
