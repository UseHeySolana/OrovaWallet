import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import AntDesign from '@expo/vector-icons/AntDesign'
import AppSettings from "@/misc/store/settingsstore";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from "expo-router";
import UserItem from "@/misc/store/userstore";

import IconLibrary from "@/misc/helpers/icons";

const settingsMenu = [
  {
    title: "Manage Accounts",
    route: "/manageaccounts",
    icon: <IconLibrary.wallet />
  },
  {
    title: "AI Assistant",
    route: "/manageaccounts",
    icon: <View className="h-[18px] w-[18px]  rounded-full">
      <Image source={require('@/assets/images/ai.png')} style={{ width: "100%", height: "100%" }}
        contentFit="cover"
      />
    </View>,
  },
  {
    title: "Smart Hedging",
    route: "/manageaccounts",
    icon: <IconLibrary.linechart />,
  },

  {
    title: "Currency",
    route: "/manageaccounts",
    icon: <IconLibrary.currency />,
  },
  {
    title: "Security",
    route: "/manageaccounts",
    icon: <IconLibrary.security />,
  },
  {
    title: "Language",
    route: "/manageaccounts",
    icon: <IconLibrary.language />,
  },

]

const settingsMenu2 = [
  {
    title: "Address Book",
    route: "/manageaccounts",
    icon: <IconLibrary.notebook />,
  },
  {
    title: "Connected Apps",
    route: "/manageaccounts",
    icon: <IconLibrary.connection />,
  },

  {
    title: "Feedback",
    route: "/manageaccounts",
    icon: <IconLibrary.commenting />,
  },
  {
    title: "Dark mode",
    route: "/manageaccounts",
    icon: <IconLibrary.moon />,
  },
  {
    title: "Logout",
    route: null,
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

  const { setDefault } = AppSettings()
  const { user, userWallet, logout } = UserItem()
  const [startWalletReg, setStartWalletReg] = useState<boolean>(false);


  return (
    <View
      className="relative pt-3 h-full w-100 flex items-center gap-y-4"
    >
      <View className="w-full px-4 flex flex-row justify-start">
        <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white">
          <IconLibrary.back />
        </Pressable>
      </View>

      <View className="bg-white mb-10 flex shadow flex-row justify-between items-center rounded-2xl w-11/12 py-5 m-auto p-2">
        <View className="flex flex-row justify-between items-center gap-x-2  ">
          <View className="h-10 w-10  rounded-full">
            <Image source={require('@/assets/images/icon.png')} style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </View>
          <View className="">
            <CText style={{ fontFamily: "bold" }} className="text-wrap">Account</CText>
            <CText className="">${userWallet.balance}</CText>
          </View>
        </View>
        <Pressable onPress={() => router.back()} className="p-3">
          <FontAwesome name="angle-right" size={18} color="black" />
        </Pressable>
      </View>





      <View className="w-11/12  m-auto px-4 py-4 shadow rounded-2xl bottom-10 bg-white ">
        {settingsMenu.map((item, index) => {
          return (
            <View key={index} className="py-2 flex flex-row justify-between items-center">
              <View className="flex flex-row justify-start items-center gap-x-2">
                <View className="h-6 flex flex-row justify-center items-center w-6">
                  {item.icon ? item.icon : <FontAwesome name="angle-right" size={18} color="black" />}
                </View>

                <CText className="text-[16px]">
                  {item.title}
                </CText>
              </View>

              <Pressable onPress={() => router.back()} className="p-3">
                <FontAwesome name="angle-right" size={18} color="black" />
              </Pressable>
            </View>
          )
        })}
      </View>

      <View className="w-11/12  m-auto p-4 rounded-2xl shadow bottom-10 bg-white ">
        {settingsMenu2.map((item, index) => {
          return (
            <Pressable onPress={() => {
              //@ts-expect-error
              { item.route ? router.push(item.route) : logout() }
            }} key={index} className="py-1 flex flex-row justify-between items-center">
              <View className="flex flex-row justify-start items-center gap-x-2">
                <View className="h-6 flex flex-row justify-center items-center w-6">
                  {item.icon ? item.icon : <FontAwesome name="angle-right" size={18} color="black" />}
                </View>
                <CText className="text-[16px]">
                  {item.title}
                </CText>
              </View>

              {item.route &&
              <Pressable onPress={() => router.back()} className="p-3">
                <FontAwesome name="angle-right" size={18} color="black" />
              </Pressable>
              }
            </Pressable>
          )
        })}
      </View>



    </View>
  );
}

export default Settings

