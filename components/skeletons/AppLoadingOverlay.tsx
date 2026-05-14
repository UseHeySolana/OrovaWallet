import { Animated, View } from "react-native";
import { useSkeletonPulse } from "./useSkeletonPulse";

/** Full-screen overlay when `AppSettings.isLoading` is true (wallet sync, bootstrap, etc.). */
export function AppLoadingOverlay() {
  const opacity = useSkeletonPulse();
  const bone = "rounded-2xl bg-grey dark:bg-accent2";

  return (
    <View
      className="absolute left-0 right-0 top-0 bottom-0 z-[100] bg-white/75 dark:bg-black/65 justify-center items-center px-8"
      accessibilityViewIsModal
      accessibilityLabel="Loading"
      pointerEvents="auto"
    >
      <View className="w-full max-w-sm gap-4">
        <Animated.View
          style={{ opacity }}
          className={`h-4 w-[55%] self-center rounded-md ${bone}`}
        />
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={{ opacity }}
            className={`h-16 w-full ${bone}`}
          />
        ))}
      </View>
    </View>
  );
}
