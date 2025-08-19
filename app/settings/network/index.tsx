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

import IconLibrary from "@/utils/icons";

interface networkSettings {
  title: string;
  route: "devnet" | "mainnet" | null;
  type: string;
  subtitle: string;
  icon: React.ReactNode;
}

const settingsMenu2 = [
  {
    title: "Mainnet",
    route: "mainnet",
    type: "toggle",
    subtitle: "All balances and transactions are real",
    icon: <IconLibrary.network />,
  },
  {
    title: "Devnet",
    route: "devnet",
    type: "toggle",
    subtitle: "Dummy Transactions and Paper Tokens",
    icon: <IconLibrary.network />,
  },
];
/*
/**
  * What should be done here
  * 1. Updates Settings and Shows Settings and What to Change
  */
function Security() {
  const { network, changeNetwork } = AppSettings();

  const networkType = {
    mainnet: network.includes("mainnet"),
    devnet: network.includes("devnet"),
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
          <CText className="text-[1.4rem]">Network</CText>
        </View>

        <View className="w-11/12  m-auto p-4 gap-y-6  rounded-2xl shadow-sm  bg-white dark:bg-accent ">
          {settingsMenu2.map((item, index) => {
            return (
              <TouchableOpacity
                key={index}
                className="py-1 flex flex-row justify-between items-center"
              >
                <View className="flex flex-row justify-start items-center gap-x-2">
                  <View className="h-6 flex flex-row justify-center items-center w-6">
                    {item.icon ? item.icon : <IconLibrary.angle_right />}
                  </View>
                  <View>
                    <CText className="text-[1.2rem]">{item.title}</CText>
                    <CText textColor="text-gray-400" className="text-[1rem] ">
                      {item.subtitle}
                    </CText>
                  </View>
                </View>

                {item.route && (
                  <>
                    {item.type === "toggle" ? (
                      <Switch
                        trackColor={{ false: "red", true: "green" }}
                        thumbColor={"white"}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => changeNetwork(item.route)}
                        //@ts-ignore
                        value={networkType[item.route]}
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() => router.back()}
                        className="p-3"
                      >
                        <IconLibrary.angle_right />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default Security;
