import React from "react";
import ConfirmActionSheetGlobal from "@/components/Sheets/ConfirmationSheetGlobal";
import CText from "@/components/TextComp";
import { useThemeContext } from "@/misc/context/ThemeContext";
import IconLibrary from "@/misc/helpers/icons";
import AppSettings from "@/misc/store/settingsstore";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

export default function StackView() {
  const { isDarkMode } = useThemeContext();
  const { isLoading, toast } = AppSettings();

  const LoadingScreen = () => (
    <View className="h-screen absolute w-full flex-1 z-40 bg-white/55 dark:bg-black/55 justify-center items-center ">
      <Image
        source={require("@/assets/images/splaash.gif")}
        alt="Security image"
        style={{ height: 70, width: 70 }}
        contentFit="contain"
      />
    </View>
  );

  const ToastModal = ({
    type,
    message,
  }: {
    type: "success" | "error" | "info";
    message: string;
  }) => {
    const bgClass =
      type === "success"
        ? "bg-green-100 dark:bg-green-900 border border-green-500"
        : type === "error"
          ? "bg-red-100 dark:bg-red-900 border border-red-500"
          : "bg-yellow-100 dark:bg-yellow-900 border border-yellow-500";

    const textColor =
      type === "success"
        ? "text-green-700 dark:text-green-300"
        : type === "error"
          ? "text-red-700 dark:text-red-300"
          : "text-yellow-700 dark:text-yellow-300";

    const iconColor =
      type === "success" ? "green" : type === "error" ? "red" : "orange";

    return (
      <View
        className={`top-12 absolute w-full p-4  z-50`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <View className="flex-row items-center rounded-2xl px-4 py-5 shadow-sm bg-white">
          {type === "success" && (
            <IconLibrary.check color={iconColor} size={20} />
          )}
          {type === "error" && (
            <IconLibrary.error color={iconColor} size={20} />
          )}
          {type === "info" && <IconLibrary.info color={iconColor} size={20} />}

          <CText
            className={`ml-3`}
            textColor={textColor}
            style={{ fontFamily: "bold", flex: 1 }}
          >
            {message}
          </CText>
        </View>
      </View>
    );
  };

  return (
    <>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]} className="bg-[#f3f3f3] dark:bg-[#0C0C0C]">
        <StatusBar
          style={isDarkMode ? "light" : "dark"}
        />
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
        {toast.show && <ToastModal type={toast.type} message={toast.message} />}
        {isLoading && <LoadingScreen />}
        <ConfirmActionSheetGlobal />
      </SafeAreaView>
    </>
  );
}

