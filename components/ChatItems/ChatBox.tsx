import { useThemeContext } from "@/context/ThemeContext";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StatusBar, TouchableOpacity } from "react-native";
import { Pressable, View } from "react-native";
import CText from "../TextComp";
import { openURL } from "@/utils/functions/extrafunctions";
import IconLibrary from "@/utils/icons";

interface ChatBoxProps {
  item: any;
  isSystem: boolean;
  aiName: string;
}
const ChatBox = (props: ChatBoxProps) => {
  const { item, isSystem, aiName } = props;
  const isUser = item.role === "user";
  const params =
    (item?.tool?.arguments?.parameter &&
      Object.keys(item.tool?.arguments?.parameter)) ||
    (item.tool?.arguments && Object.keys(item.tool?.arguments)) ||
    [];

  const iconSource =
    item.tool?.status === "pending"
      ? require("@/assets/toolstatus/pending.png")
      : item.tool?.status === "complete"
      ? require("@/assets/toolstatus/complete.png")
      : require("@/assets/toolstatus/failed.png");

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const AnimatedImage = Animated.createAnimatedComponent(Image);
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      className={`w-full flex-col gap-y-2 mb-2 ${
        isSystem ? "justify-start" : "justify-end"
      }`}
    >
      <View className="flex flex-row items-center gap-x-2 ">
        <Image
          source={require("@/assets/images/ai.png")}
          style={{ width: 30, height: 30 }}
          contentFit="contain"
          className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
        />
        <CText className="text-[12px]" style={{ fontFamily: "bold" }}>
          {aiName}
        </CText>
      </View>
      <View
        className={`bg-white dark:bg-black p-2 rounded-b-xl rounded-tr-xl dark:border border-accent2 w-[70%] gap-y-2 ${
          isSystem ? "ml-2" : "mr-2"
        }`}
      >
        <View className="bg-grey dark:bg-accent p-2 rounded-lg">
          <CText className="text-[12px]">{item.content}</CText>
        </View>
      </View>
    </View>
  );
};

export default ChatBox;
