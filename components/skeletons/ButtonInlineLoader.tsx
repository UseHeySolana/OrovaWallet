import { Animated, View } from "react-native";
import { useSkeletonPulse } from "./useSkeletonPulse";

type Variant = "primary" | "secondary";

/**
 * In-button loading strip (replaces ActivityIndicator) for primary/secondary styles.
 */
export function ButtonInlineLoader({ variant = "primary" }: { variant?: Variant }) {
  const opacity = useSkeletonPulse();
  const backgroundColor =
    variant === "primary"
      ? "rgba(255,255,255,0.88)"
      : "rgba(30,30,30,0.5)";

  return (
    <View className="min-h-[20px] justify-center items-center px-1">
      <Animated.View
        style={{
          opacity,
          width: 32,
          height: 6,
          borderRadius: 3,
          backgroundColor,
        }}
      />
    </View>
  );
}
