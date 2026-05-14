import { Animated, View } from "react-native";
import { useSkeletonPulse } from "./useSkeletonPulse";

/** Replaces spinner on send-status while a transaction is processing. */
export function TransactionStatusRingSkeleton() {
  const opacity = useSkeletonPulse();

  return (
    <View className="h-24 w-24 items-center justify-center">
      <Animated.View
        style={{
          opacity,
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 5,
          borderColor: "#971BB2",
        }}
      />
    </View>
  );
}
