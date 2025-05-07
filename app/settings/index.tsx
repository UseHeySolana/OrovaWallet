import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import UserItem from "@/misc/store/userstore";

import IconLibrary from "@/misc/helpers/icons";
import { useThemeContext } from "@/misc/context/ThemeContext";

const settingsMenu = [
  // {
  //   title: "Manage Accounts",
  //   route: "/manageaccounts",
  //   icon: <IconLibrary.wallet />
  // },
  {
    title: "AI Assistant",
    route: "/aisetup",
    subtitle: `${AppSettings.getState().aiName} -- ${AppSettings.getState().aiLanguage}`,
    icon: <View className="h-[18px] w-[18px]  rounded-full">
      <Image source={require('@/assets/images/ai.png')} style={{ width: "100%", height: "100%" }}
        contentFit="cover"
      />
    </View>,
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
    route: '/settings/security',
    icon: <IconLibrary.security />,
  },

  {
    title: "Network",
    route: '/settings/network',
    subtitle: AppSettings.getState().network.includes('mainnet') ? 'Mainnet' : 'Devnet',

    icon: <IconLibrary.network />,
  },
  // {
  //   title: "Language",
  //   route: "/manageaccounts",
  //   icon: <IconLibrary.language />,
  // },

]

const settingsMenu2 = [
  {
    title: "Address Book",
    route: '/settings/addressbook',
    subtitle: "Check your contacts that are on HeySolana",

    icon: <IconLibrary.notebook />,
  },
  {
    title: "Connected Apps",
    route: '/settings/apps',
    subtitle: "Activate tools that HeySolana interacts with",

    icon: <IconLibrary.connection />,
  },

  // {
  //   title: "Feedback",
  //   route: "/manageaccounts",
  //   icon: <IconLibrary.commenting />,
  // },
  {
    title: "Dark mode",
    route: 'dark',
    type: 'toggle',
    subtitle: "Change the app mode",

  },
  {
    title: "Logout",
    route: "logout",
    subtitle: "Sign out/ Remove wallet and clear data",
    icon: <IconLibrary.logout />,
  },
]
/*
/**
  * What should be done here
  * 1. Updates Settings and Shows Settings and What to Change
  */
function Settings() {
  const [recording, setRecording] = useState(false);

  const { isDarkMode, toggleTheme } = useThemeContext()
  const { setDefault, setLoading } = AppSettings()
  const { user, userWallet, logout } = UserItem()
  const [startWalletReg, setStartWalletReg] = useState<boolean>(false);

  const routeNavigation = (route: any, type?: string) => {
    if (type == 'toggle') {
      return;
    }
    if (route == null) {
      return;
    }
    if (route == 'logout') {
      logout();
      router.replace('/');
      return;
    }
    if (route !== null) {
      router.push(route);
    }

  }

  return (
    <View className="relative pt-3 bg-grey dark:bg-dark  w-100 flex-1 items-start justify-start gap-y-4">
      <View className="w-full gap-y-4">

        <View className="w-full px-4 flex flex-row justify-start">
          <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
            <IconLibrary.back />
          </Pressable>
        </View>

        <View className="bg-white dark:bg-accent mb-10 flex shadow flex-row justify-between items-center rounded-2xl w-11/12 py-5 m-auto p-2">
          <View className="flex flex-row justify-between items-center gap-x-2  ">
            <View className="h-10 w-10  rounded-full">
              <Image source={require('@/assets/images/icon.png')} style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>
            <View className="">
              <CText style={{ fontFamily: "bold" }} className="text-wrap">Account</CText>
              <CText className="">${userWallet.totalUsdBalance.toFixed(2)}</CText>
            </View>
          </View>
          <Pressable onPress={() => router.back()} className="p-3">
            <IconLibrary.angle_right />
          </Pressable>
        </View>

        <View className="w-11/12   m-auto px-4 py-4 shadow rounded-2xl bottom-10 bg-white dark:bg-accent ">
          {settingsMenu.map((item, index) => {
            return (
              <TouchableOpacity
                // @ts-expect-error
                onPress={() => { item.route && router.push(item.route) }}
                key={index} className="py-2 flex  flex-row justify-between items-center ">
                <View className="flex-1 flex-row justify-start items-center gap-x-2">
                  <View className="h-6 flex flex-row justify-center items-center w-6">
                    {item.icon ? item.icon : <IconLibrary.angle_right />}
                  </View>
                  <View className="flex-1">
                    <CText className="text-[1.2rem]">
                      {item.title}
                    </CText>
                    <CText textColor="text-gray-400 text-wrap" className="text-[1rem]">
                      {item.subtitle}
                    </CText>
                  </View>
                </View>

                <Pressable onPress={() => router.back()} className="p-3">
                  <IconLibrary.angle_right />
                </Pressable>
              </TouchableOpacity>
            )
          })}
        </View>

        <View className="w-11/12  m-auto p-4 gap-y-4  rounded-2xl shadow bottom-10 bg-white dark:bg-accent ">
          {settingsMenu2.map((item, index) => {
            return (
              <Pressable onPress={() => {

                routeNavigation(item.route, item.type)
              }} key={index} className="py-1 flex flex-row justify-between items-center">
                <View className="flex-1 flex-row justify-start items-center gap-x-2">
                  <View className="h-6 flex flex-row justify-center items-center w-6">
                    {item.icon ? item.icon : <IconLibrary.angle_right />}
                  </View>
                  <View className="flex-1">
                    <CText className="text-[1.2rem]">
                      {item.title}
                    </CText>
                    <CText textColor="text-gray-400" className="text-[1rem] ">
                      {item.subtitle}
                    </CText>
                  </View>
                </View>

                {item.route && item.route !== "logout" &&
                  <>
                    {item.type === 'toggle' ?
                      <Switch
                        trackColor={{ false: 'red', true: 'green' }}
                        thumbColor={'white'}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => {
                          toggleTheme(isDarkMode ? 'light' : 'dark')
                          setLoading(false)
                        }}
                        value={isDarkMode}
                      />
                      :
                      <Pressable onPress={() => router.back()} className="p-3">
                        <IconLibrary.angle_right />
                      </Pressable>
                    }
                  </>

                }
              </Pressable>
            )
          })}
        </View>

      </View>




    </View>
  );
}

export default Settings

