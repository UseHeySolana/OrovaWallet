import React from "react";
import { SafeAreaView, StatusBar, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CustomStatusBar = ({ backgroundColor, ...props }: any) => {
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={{
        height:
          backgroundColor == "transparent" ? 0 : StatusBar.currentHeight ?? top,
        backgroundColor,
      }}
    >
      <SafeAreaView style={{ backgroundColor }}>
        <StatusBar translucent backgroundColor={backgroundColor} {...props} />
      </SafeAreaView>
    </View>
  );
};

export default CustomStatusBar;
