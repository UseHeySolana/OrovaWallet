import { Animated, View } from "react-native";
import { useSkeletonPulse } from "./useSkeletonPulse";

/** Send token / amount screens while `token` is not yet resolved from wallet store. */
export function SendFlowScreenSkeleton() {
  const opacity = useSkeletonPulse();
  const bone = "rounded-md bg-grey dark:bg-accent2";

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1 py-4 px-4">
      <View className="flex-row items-center gap-5 mb-6">
        <Animated.View
          style={{ opacity }}
          className="h-12 w-12 rounded-full bg-grey dark:bg-accent2"
        />
        <Animated.View
          style={{ opacity }}
          className={`h-8 flex-1 max-w-[220px] rounded-lg ${bone}`}
        />
      </View>

      <Animated.View
        style={{ opacity }}
        className="rounded-xl bg-white dark:bg-accent p-4 mb-6 flex-row items-center gap-3"
      >
        <View className="h-14 w-14 rounded-full bg-grey dark:bg-accent2" />
        <View className="flex-1 gap-2">
          <View className={`h-5 w-[55%] rounded ${bone}`} />
          <View className={`h-4 w-[40%] rounded ${bone}`} />
        </View>
      </Animated.View>

      <Animated.View
        style={{ opacity }}
        className="rounded-xl bg-white dark:bg-accent p-4 gap-3"
      >
        <View className={`h-4 w-24 rounded ${bone}`} />
        <View className={`h-12 w-full rounded-lg ${bone}`} />
        <View className={`h-12 w-full rounded-xl ${bone}`} />
      </Animated.View>
    </View>
  );
}
