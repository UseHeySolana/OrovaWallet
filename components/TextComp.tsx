// import { Text, TextProps } from "react-native";
// import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

// interface CustomTextProps extends TextProps {
//   children: React.ReactNode;
//   textColor?: string;
// }

// const CText: React.FC<CustomTextProps> = ({
//   style,
//   children,
//   className,
//   textColor,
//   ...props
// }) => (
//   <Animated.Text
//     entering={FadeIn.duration(200).delay(100)}
//     {...props}
//     className={`${
//       textColor ? textColor : "text-[1rem] text-dark dark:text-white"
//     } ${className}`}
//     style={[{ fontFamily: "reg" }, style]}
//   >
//     {children}
//   </Animated.Text>
// );

// export default CText;

// import React, { useEffect, useState } from "react";
// import { TextProps } from "react-native";
// import Animated, {
//   FadeIn,
//   useSharedValue,
//   withTiming,
//   useAnimatedReaction,
//   runOnJS,
// } from "react-native-reanimated";

// interface CustomTextProps extends TextProps {
//   children: React.ReactNode;
//   textColor?: string;
//   className?: string;
// }

// const isNumeric = (value: any): boolean => {
//   if (typeof value === "number") return true;
//   if (typeof value === "string") return /^-?\d+(\.\d+)?$/.test(value);
//   return false;
// };

// const formatNumber = (num: number): string => {
//   if (Math.abs(num) < 1 && num !== 0) {
//     return num.toString();
//   }
//   return new Intl.NumberFormat(undefined, {
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 10,
//   }).format(num);
// };

// const CText: React.FC<CustomTextProps> = ({
//   style,
//   children,
//   className,
//   textColor,
//   ...props
// }) => {
//   const isNumber = isNumeric(children);
//   const [displayText, setDisplayText] = useState<React.ReactNode>(children);
//   const animatedValue = useSharedValue(0);

//   useEffect(() => {
//     if (isNumber) {
//       const target =
//         typeof children === "number"
//           ? children
//           : parseFloat(children as string);
//       animatedValue.value = withTiming(target, { duration: 600 });
//     }
//   }, [children]);

//   // Safe handler to be passed to runOnJS
//   const updateDisplayText = (value: number) => {
//     const formatted = formatNumber(value);
//     setDisplayText(formatted);
//   };

//   const showThreshold = 0.02; // Only show numbers above this
//   const minDisplayDelta = 0.03; // Prevent flicker near 0

//   useAnimatedReaction(
//     () => animatedValue.value,
//     (currentValue, prevValue) => {
//       if (
//         isNumber &&
//         currentValue !== prevValue &&
//         (currentValue > showThreshold ||
//           Math.abs(currentValue - prevValue!) > minDisplayDelta)
//       ) {
//         runOnJS(updateDisplayText)(currentValue);
//       }
//     },
//     []
//   );

//   // useAnimatedReaction(
//   //   () => animatedValue.value,
//   //   (currentValue, prevValue) => {
//   //     if (isNumber && currentValue !== prevValue) {
//   //       runOnJS(updateDisplayText)(currentValue);
//   //     }
//   //   },
//   //   []
//   // );

//   return (
//     <Animated.Text
//       entering={FadeIn.duration(200).delay(100)}
//       {...props}
//       className={`${textColor ?? "text-[1rem] text-dark dark:text-white"} ${
//         className ?? ""
//       }`}
//       style={[{ fontFamily: "reg" }, style]}
//     >
//       {isNumber ? displayText : children}
//     </Animated.Text>
//   );
// };

// export default CText;

import React, { useEffect, useState } from "react";
import { TextProps } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  withTiming,
  useAnimatedReaction,
  runOnJS,
  Easing,
  withSpring,
} from "react-native-reanimated";

interface CustomTextProps extends TextProps {
  children: React.ReactNode;
  textColor?: string;
  className?: string;
}

const isNumeric = (value: any): boolean => {
  if (typeof value === "number") return true;
  if (typeof value === "string") return /^-?\d+(\.\d+)?$/.test(value);
  return false;
};

const formatNumber = (num: number): string => {
  if (Math.abs(num) < 1 && num !== 0) {
    return num.toPrecision(4).replace(/\.?0+$/, "");
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(num);
};

const CText: React.FC<CustomTextProps> = ({
  style,
  children,
  className,
  textColor,
  ...props
}) => {
  const isNumber = isNumeric(children);
  const [displayText, setDisplayText] = useState<React.ReactNode>(
    isNumber ? null : children
  );
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    if (isNumber) {
      const finalValue =
        typeof children === "number"
          ? children
          : parseFloat(children as string);

      const startFrom = finalValue * 0.9;

      animatedValue.value = startFrom;

      animatedValue.value = withSpring(finalValue, {
        // duration: 800,
        damping: 15,
        stiffness: 1000,
        // easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
    }
  }, [children]);

  const updateDisplayText = (val: number) => {
    const finalValue =
      typeof children === "number" ? children : parseFloat(children as string);

    if (val >= 0.0001 || val >= finalValue * 0.95) {
      setDisplayText(formatNumber(val));
    }
  };

  useAnimatedReaction(
    () => animatedValue.value,
    (current, prev) => {
      if (isNumber && current !== prev) {
        runOnJS(updateDisplayText)(current);
      }
    },
    []
  );

  return (
    <Animated.Text
      // entering={FadeIn.duration(200).delay(100)}
      {...props}
      className={`${textColor ?? "text-[1rem] text-dark dark:text-white"} ${
        className ?? ""
      }`}
      style={[{ fontFamily: "reg" }, style]}
    >
      {displayText ?? ""}
    </Animated.Text>
  );
};

export default CText;
