import React from "react";
import ConfirmActionSheetGlobal from "@/components/Sheets/ConfirmationSheetGlobal";
import PurchaseConfirmationSheet from "@/components/Sheets/PurchaseConfirmationSheet";
import { CText } from "@/components/TextComp";
import { useThemeContext } from "@/context/ThemeContext";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import { Stack } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppLoadingOverlay } from "@/components/skeletons";

export default function StackView() {
  const { isDarkMode } = useThemeContext();
  const { isLoading, toast } = AppSettings();

  const ToastModal = ({
    type,
    message,
  }: {
    type: "success" | "error" | "info";
    message: string;
  }) => {
    const toastStyles = {
      success: {
        title: "Success",
        icon: IconLibrary.check,
        iconColor: "#16A34A",
        iconBg: "bg-green-50 dark:bg-green-950/60",
        accent: "bg-green-500",
      },
      error: {
        title: "Something went wrong",
        icon: IconLibrary.error,
        iconColor: "#EF4444",
        iconBg: "bg-red-50 dark:bg-red-950/60",
        accent: "bg-red-500",
      },
      info: {
        title: "Heads up",
        icon: IconLibrary.info,
        iconColor: "#971BB2",
        iconBg: "bg-purple/10 dark:bg-purple/20",
        accent: "bg-purple",
      },
    }[type];

    const ToastIcon = toastStyles.icon;

    return (
      <View
        className="top-20 absolute w-full px-4 z-50"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDarkMode ? 0.35 : 0.12,
          shadowRadius: 18,
          elevation: 8,
        }}
      >
        <View className="overflow-hidden rounded-3xl border border-grey/80 bg-white dark:border-line dark:bg-accent">
          <View className={`absolute left-0 top-0 h-full w-1 ${toastStyles.accent}`} />
          <View className="flex-row items-center px-4 py-4">
            <View
              className={`h-11 w-11 items-center justify-center rounded-2xl ${toastStyles.iconBg}`}
            >
              <ToastIcon color={toastStyles.iconColor} size={21} />
            </View>

            <View className="ml-3 flex-1">
              <CText
                className="text-[0.95rem]"
                style={{ fontFamily: "bold" }}
              >
                {toastStyles.title}
              </CText>
              <CText
                className="mt-0.5 text-[0.85rem] text-black/60 dark:text-grey/70"
                numberOfLines={2}
              >
                {message}
              </CText>
            </View>
          </View>
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
        {isLoading && <AppLoadingOverlay />}
        <ConfirmActionSheetGlobal />
        <PurchaseConfirmationSheet />
      </SafeAreaView>
    </>
  );
}

