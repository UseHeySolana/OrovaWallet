import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/** Shared opacity loop for skeleton placeholders. */
export function useSkeletonPulse() {
  const opacity = useRef(new Animated.Value(0.34)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.76,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.28,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}
