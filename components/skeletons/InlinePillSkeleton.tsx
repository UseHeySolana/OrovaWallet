import { Animated, View } from "react-native";
import { useSkeletonPulse } from "./useSkeletonPulse";

/** Compact pill for install / icon-sized slots (e.g. app detail header). */
export function InlinePillSkeleton({
  width = 72,
  height = 36,
}: {
  width?: number;
  height?: number;
}) {
  const opacity = useSkeletonPulse();
  return (
    <Animated.View
      style={{
        opacity,
        width,
        height,
        borderRadius: height / 2,
      }}
      className="bg-grey dark:bg-accent2"
    />
  );
}
