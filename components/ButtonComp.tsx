import React from "react";
import { Text, TouchableNativeFeedback, TouchableOpacity, View } from "react-native";
import tracker from "@/utils/tracker";
import { ButtonInlineLoader } from "@/components/skeletons";


interface ButtonsProp {
  loading?: boolean
  disabled?: boolean;
  text: string;
  type?: "primary" | "secondary";
  className?: string;
  textClass?: string;
  onPress: () => void;
  style?: {};
  icon?: React.ReactNode;
  buttonType?: "feedback" | "pressable"
  accessibilityLabel?: string;
}

/**
 * 
 * @param props interface Buttons {
  loading?: boolean
text:string;
type?: "primary" | "secondary" ;
className?:string;
textClass?:string;
onPress:() => void;
  icon?: React.ReactNode;
  buttonType?: "feedback" | "pressable"
}
 * @returns 
 */
export default function Buttons(props: ButtonsProp) {
  const { loading, disabled, style, textClass, text, className, type = "primary", onPress, buttonType, accessibilityLabel } = props;
  const loaderVariant = type === "primary" ? "primary" : "secondary";
  const isDisabled = disabled || loading;

  const buttonColor = type === "primary" ? "bg-[#971BB2]  " : "bg-gray-200  dark:bg-accent2"
  const textColor = type === "primary" ? "#FFFFFF" : "#FFFFFF"

  const trackPress = () => {
    if (isDisabled) return;
    tracker.buttons(text || accessibilityLabel || "Button", 1);
    onPress();
  }

  const innerContent = (
    <>
      {props.icon}
      {loading ? (
        <ButtonInlineLoader variant={loaderVariant} />
      ) : text ? (
        <Text
          style={{ fontFamily: "bold", color: textColor, textAlign: "center", fontSize: 16 }}
          className={textClass}
        >
          {text}
        </Text>
      ) : null}
    </>
  );

  return (
    <>
      {buttonType === "feedback" ? (

        <>
          <View style={{
            borderRadius: 50,  // Match this with your desired border radius
            overflow: 'hidden',  // This is the key style that contains the ripple
          }}>
            <TouchableNativeFeedback
              style={{ ...style }}
              background={TouchableNativeFeedback.Ripple('#971BB2', false)}
              onPress={trackPress}
              disabled={isDisabled}>
              <View
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityState={{ disabled: isDisabled }}
                className={`${buttonColor} ${className ? className : "py-5 rounded-full"} w-full flex flex-row justify-center items-center gap-x-2 ${isDisabled ? "opacity-50" : ""}`}
              >
                {innerContent}
              </View>
            </TouchableNativeFeedback>
          </View>
        </>
      ) :
        <TouchableOpacity
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: isDisabled }}
          onPress={trackPress}
          disabled={isDisabled}
          style={[style, className?.includes?.("flex-1") && { flex: 1 }, isDisabled && { opacity: 0.5 }]}
        >
          <View className={`${buttonColor} ${className ? className : "py-5  rounded-full"} w-full flex flex-row justify-center items-center gap-x-2`}>
            {innerContent}
          </View>
        </TouchableOpacity>
      }
    </>
  );
}
