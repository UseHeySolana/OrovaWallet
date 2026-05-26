import React from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import AppSettings from "@/utils/store/settingsstore.store";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import * as Updates from "expo-updates";

import Ionicons from "@expo/vector-icons/Ionicons";

import IconLibrary from "@/utils/icons";
import { useThemeContext } from "@/context/ThemeContext";
import {
  deactivatePushTokenOnBackend,
  registerPushTokenWithBackend,
} from "@/services/push/pushNotifications";
import { PushNotificationDevTools } from "@/services/push/PushNotificationDevTools";

type SettingsMenu2Item = {
  title: string;
  route: string | null;
  subtitle?: string;
  icon?: React.ReactNode;
  type?: "toggle";
  /** When `type` is `toggle`, which setting the switch controls */
  toggleFor?: "theme" | "notifications";
};

const settingsMenu = [
  // {
  //   title: "Manage Accounts",
  //   route: "/manageaccounts",
  //   icon: <IconLibrary.wallet />
  // },
  {
    title: "AI Assistant",
    route: "/aisetup",
    subtitle: `${AppSettings.getState().aiName} -- ${AppSettings.getState().aiLanguage
      }`,
    icon: (
      <View className="h-[18px] w-[18px]  rounded-full">
        <Image
          source={require("@/assets/images/ai.png")}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      </View>
    ),
  },
  {
    title: "Voice Security",
    route: "/voicereg",
    subtitle: "Enroll or update the voice used for verified commands",
    icon: (
      <Ionicons
        name="mic-circle-outline"
        size={24}
        color="#971BB2"
      />
    ),
  },
  // {
  //   title: "Smart Hedging",
  //   route: "/manageaccounts",
  //   icon: <IconLibrary.linechart />,
  // },

  // {
  //   title: "Currency",
  //   route: "/manageaccounts",
  //   icon: <IconLibrary.currency />,
  // },
  {
    title: "Security",
    subtitle: "Manage authentication and more",
    route: "/settings/security",
    icon: <IconLibrary.security />,
  },

  {
    title: "Network",
    route: "/settings/network",
    subtitle: AppSettings.getState().network.includes("mainnet")
      ? "Mainnet"
      : "Devnet",

    icon: <IconLibrary.network />,
  },
  // {
  //   title: "Language",
  //   route: "/manageaccounts",
  //   icon: <IconLibrary.language />,
  // },
];

const settingsMenu2: SettingsMenu2Item[] = [
  {
    title: "Address Book",
    route: "/settings/addressbook",
    subtitle: "Check your contacts that are on HeySolana",

    icon: <IconLibrary.notebook />,
  },
  {
    title: "Connected Apps",
    route: "/settings/apps",
    subtitle: "Activate tools that HeySolana interacts with",

    icon: <IconLibrary.connection />,
  },

  // {
  //   title: "Feedback",
  //   route: "/manageaccounts",
  //   icon: <IconLibrary.commenting />,
  // },
  {
    title: "Notifications",
    route: "notifications",
    type: "toggle",
    toggleFor: "notifications",
    subtitle: "Wallet alerts, price alerts, and server push",
  },
  {
    title: "Dark mode",
    route: "dark",
    type: "toggle",
    toggleFor: "theme",
    subtitle: "Change the app mode",
    icon: <IconLibrary.moon />,
  },
  {
    title: "Logout",
    route: "logout",
    subtitle: "Sign out/ Remove wallet and clear data",
    icon: <IconLibrary.logout />,
  },
];
/*
/**
  * What should be done here
  * 1. Updates Settings and Shows Settings and What to Change
  */
export default function Settings() {
  const { isDarkMode, toggleTheme } = useThemeContext();
  const { setLoading, notifications, updateNotifications, setToast } = AppSettings();
  const { user, userWallet, logout } = UserItem();

  const routeNavigation = (route: any, type?: string) => {
    if (type === "toggle") {
      return;
    }
    if (route == null) {
      return;
    }
    if (route === "logout") {
      logout();
      router.replace("/auth/login");
      return;
    }
    if (route !== null) {
      router.push(route);
    }
  };

  return (
    <View className="relative pt-3 bg-grey dark:bg-dark  w-100 flex-1 items-start justify-start gap-y-4">
      <View className="w-full px-4 flex flex-row justify-start">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
      </View>
      <ScrollView
        className="w-full"
        contentContainerStyle={{
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.push("/dashboard/account")}
          activeOpacity={0.8}
          className="bg-white dark:bg-accent mb-10 flex shadow-sm flex-row justify-between items-center rounded-2xl w-11/12 py-5 m-auto p-2"
        >
          <View className="flex flex-row justify-between items-center gap-x-2  ">
            <View className="h-10 w-10  rounded-full">
              <Image
                source={require("@/assets/images/ballicon.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>
            <View className="">
              <CText style={{ fontFamily: "bold" }} className="text-wrap">
                Account
              </CText>
              <CText className="">
                ${userWallet.totalUsdBalance.toFixed(2)}
              </CText>
            </View>
          </View>
          <View className="p-3">
            <IconLibrary.angle_right />
          </View>
        </TouchableOpacity>

        <View className="w-11/12   m-auto px-4 py-4 shadow-sm rounded-2xl bottom-10 bg-white dark:bg-accent ">
          {settingsMenu.map((item, index) => {
            return (
              <TouchableOpacity
                onPress={() => {
                  if (item.route) {
                    router.push(item.route as any);
                  }
                }}
                key={index}
                className="py-2 flex  flex-row justify-between items-center "
              >
                <View className="flex-1 flex-row justify-start items-center gap-x-2">
                  <View className="h-6 flex flex-row justify-center items-center w-6">
                    {item.icon ? item.icon : <IconLibrary.angle_right />}
                  </View>
                  <View className="flex-1">
                    <CText className="text-[1.2rem]">{item.title}</CText>
                    <CText
                      textColor="text-gray-400 text-wrap"
                      className="text-[1rem]"
                    >
                      {item.subtitle}
                    </CText>
                  </View>
                </View>

                <Pressable onPress={() => router.back()} className="p-3">
                  <IconLibrary.angle_right />
                </Pressable>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="w-11/12  m-auto p-4 gap-y-4  rounded-2xl shadow-sm  bottom-10 bg-white dark:bg-accent ">
          {settingsMenu2.map((item, index) => {
            return (
              <Pressable
                onPress={() => {
                  routeNavigation(item.route, item.type);
                }}
                key={index}
                className="py-1 flex flex-row justify-between items-center"
              >
                <View className="flex-1 flex-row justify-start items-center gap-x-2">
                  <View className="h-6 flex flex-row justify-center items-center w-6">
                    {item.toggleFor === "notifications" ? (
                      <Ionicons
                        name="notifications-outline"
                        size={20}
                        color={isDarkMode ? "#f3f4f6" : "#374151"}
                      />
                    ) : item.icon ? (
                      item.icon
                    ) : (
                      <IconLibrary.angle_right />
                    )}
                  </View>
                  <View className="flex-1">
                    <CText className="text-[1.2rem]">{item.title}</CText>
                    <CText textColor="text-gray-400" className="text-[1rem] ">
                      {item.subtitle}
                    </CText>
                  </View>
                </View>

                {item.route && item.route !== "logout" && (
                  <>
                    {item.type === "toggle" ? (
                      <Switch
                        trackColor={{ false: "red", true: "green" }}
                        thumbColor={"white"}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={(enabled) => {
                          if (item.toggleFor === "notifications") {
                            updateNotifications(enabled);
                            if (enabled) {
                              void registerPushTokenWithBackend({
                                user,
                              }).then((ok) => {
                                if (!ok) {
                                  setToast(
                                    "Could not enable push. Check system notification permission and EXPO_PUBLIC_API_URL.",
                                    "error"
                                  );
                                  updateNotifications(false);
                                }
                              });
                            } else {
                              void deactivatePushTokenOnBackend();
                            }
                            return;
                          }
                          toggleTheme(enabled ? "dark" : "light");
                          setLoading(false);
                        }}
                        value={
                          item.toggleFor === "notifications"
                            ? notifications
                            : isDarkMode
                        }
                      />
                    ) : (
                      <Pressable onPress={() => router.back()} className="p-3">
                        <IconLibrary.angle_right />
                      </Pressable>
                    )}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        <View className="w-full px-4">
          <CText className="text-center">
            Version: {Updates.runtimeVersion}
          </CText>
        </View>

        {__DEV__ ? (
          <View className="w-11/12 m-auto mt-4 mb-10 px-4 py-4 rounded-2xl bg-white dark:bg-accent border border-dashed border-grey/30">
            <CText style={{ fontFamily: "bold" }} className="text-[1rem] mb-2">
              Developer
            </CText>
            <Pressable
              onPress={() => router.push("/dev-network")}
              className="py-3 px-4 rounded-xl bg-purple"
            >
              <CText className="text-white text-center">Network request log</CText>
            </Pressable>
            <Pressable
              onPress={() => router.push("/dev-voice")}
              className="mt-2 py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
            >
              <CText className="text-center">Voice verification test</CText>
            </Pressable>
            <CText className="text-[0.8rem] opacity-60 mt-2 text-center">
              Jupiter logs, push tools, and voice verification checks (dev only)
            </CText>
            <PushNotificationDevTools />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}


