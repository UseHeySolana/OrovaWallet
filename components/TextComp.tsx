import React, { useEffect, useState } from "react";
import { Text, TextProps } from "react-native";

import Animated, {
  FadeIn,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

interface CustomTextProps extends TextProps {
  children: React.ReactNode;
  textColor?: string;
}

const CText: React.FC<CustomTextProps> = ({
  style,
  children,
  className,
  textColor,
  ...props
}) => (
  <Animated.Text
    entering={FadeIn.duration(200).delay(100)}
    {...props}
    className={`${
      textColor ? textColor : "text-[1rem] text-dark dark:text-white"
    } ${className}`}
    style={[{ fontFamily: "reg" }, style]}
  >
    {children}
  </Animated.Text>
);

export default CText;

interface CNumberProps extends TextProps {
  value: number;
  textColor?: string;
  className?: string;
}

const formatNumber = (num: number): string => {
  if (Math.abs(num) < 1 && num !== 0) {
    return num.toPrecision(4).replace(/\.?0+$/, "");
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(num);
};

const CNumber: React.FC<CNumberProps> = ({
  style,
  value,
  textColor,
  className,
  ...props
}) => {
  const [displayText, setDisplayText] = useState(formatNumber(0));
  const animatedValue = useSharedValue(value * 0.6);
  const flipProgress = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration: 1000 });

    flipProgress.value = 0;
    flipProgress.value = withTiming(1, { duration: 800 });
  }, [value]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDisplayText(formatNumber(Number(value)));
    }, 500); // wait for half the flip to change number

    return () => clearTimeout(timeout);
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(
      flipProgress.value,
      [0, 0.5, 1],
      [0, 90, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ rotateX: `${rotateX}deg` }],
    };
  });

  return (
    <Animated.Text
      {...props}

      className={`${textColor ?? "text-[1rem] text-dark dark:text-white"} ${
        className ?? ""
      }`}
      style={[
        animatedStyle,
        { fontFamily: "reg", backfaceVisibility: "hidden" },
        style,
      ]}
    >
      {displayText}
    </Animated.Text>
  );
};
export { CText, CNumber };
