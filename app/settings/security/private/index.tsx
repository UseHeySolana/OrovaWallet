import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import CText from "@/components/TextComp";
import AppSettings from "@/utils/store/settingsstore.store";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";

import IconLibrary from "@/utils/icons";
import { useThemeContext } from "@/context/ThemeContext";
import SetPin from "@/components/Sheets/SetPinSheet";
import PrivateKeySheet from "@/components/Sheets/PrivateKeySheet";

const privateMenu = [
  {
    title: "Show Private Key",
    route: "dark",
    subtitle: "Show your private key/key phrases",
    icon: <IconLibrary.lock />,
    type: "private-key",
  },
  {
    title: "Show Passphrase",
    route: "dark",
    subtitle: "Show your passphrase",
    icon: <IconLibrary.password />,
    type: "passphrase",
  },
];
/*
/**
  * What should be done here
  * 1. Updates Settings and Shows Settings and What to Change
  */
export default function Security() {
  const [recording, setRecording] = useState(false);

  const { isDarkMode, toggleTheme } = useThemeContext();
  const { setDefault, openWithAuth, setOpenWithAuth, setToast } = AppSettings();
  const { user, userWallet, logout } = UserItem();
  const [startWalletReg, setStartWalletReg] = useState<boolean>(false);
  const [setPinOpen, setSetPinOpen] = useState<boolean>(true);
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [privateKeyType, setPrivateKeyType] = useState<
    "private-key" | "passphrase"
  >("private-key");

  const routeNavigation = (route: any, type?: string) => {
    if (type == "toggle") {
      return;
    }
    if (type == "activate") {
      setSetPinOpen(!setPinOpen);
      return;
    }
    if (route == null) {
      return;
    }
    if (route == "logout") {
      logout();
      router.replace("/");
      return;
    }
    if (route !== null) {
      router.push(route);
    }
  };

  return (
    <View className="relative pt-3 bg-grey dark:bg-dark  w-100 flex-1 items-start justify-start gap-y-4">
      <View className="w-full gap-y-6">
        <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
          <Pressable
            onPress={() => router.back()}
            className="p-3 rounded-full bg-white dark:bg-accent"
          >
            <IconLibrary.back />
          </Pressable>
          <CText className="text-[1.4rem]">Private Key</CText>
        </View>

        <View className="w-11/12  m-auto p-4 gap-y-4  rounded-2xl shadow  bg-white dark:bg-accent ">
          {privateMenu.map((item, index) => {
            return (
              <Pressable
                onPress={() => {
                  setShowPrivateKey(true);
                  setPrivateKeyType(item.type as "private-key" | "passphrase");
                }}
                key={index}
                className="py-1 flex flex-row justify-between items-center"
              >
                <View className="flex-1 flex-row justify-start items-center gap-x-2">
                  <View className="h-6 flex flex-row justify-center items-center w-6">
                    {item.icon ? item.icon : <IconLibrary.angle_right />}
                  </View>
                  <View className="flex-1">
                    <CText className="text-[1.2rem]">{item.title}</CText>
                    <CText textColor="text-gray-400" className="text-[1rem] ">
                      {item.subtitle}
                    </CText>
                  </View>
                </View>
                <Pressable onPress={() => { }} className="p-3">
                  <IconLibrary.angle_right />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SetPin
        open={setPinOpen}
        setOpen={setSetPinOpen}
        usage="verify"
        onSuccess={() => {
          console.log("success");
        }}
      />

      <PrivateKeySheet
        open={showPrivateKey}
        setOpen={setShowPrivateKey}
        type={privateKeyType}
      />
    </View>
  );
}

