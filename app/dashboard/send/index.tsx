import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, TouchableNativeFeedback, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { Image } from "expo-image";
import AntDesign from '@expo/vector-icons/AntDesign'
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import { Keypair } from "@solana/web3.js";
import UserItem from "@/misc/store/userstore";
import IconLibrary from "@/misc/helpers/icons";
import { useThemeContext } from "@/misc/context/ThemeContext";

const Items = [
  {
    id: 1,
    title: "Voice Assistant",
    description: "",
    subItems: [],
    type: "toogle",
  },
  {
    id: 2,
    title: "Language",
    description: "",
    subItems: [{
      id: 1,
      title: "English",
      description: "",
    }],
    type: "dropdown",
  },
  {
    id: 3,
    title: "Assistant Voice",
    description: "",
    subItems: [{
      id: 1,
      title: "Kira",
      description: "",
    }],
    type: "dropdown",
  },
  {
    id: 4,
    title: "Assistant Name",
    description: "",
    subItems: [{
      id: 1,
      title: "User Input",
      description: "",
    }],
    type: "dropdown",
  }
]
/**
  * What should be done here
  * 1: Send tokens
  */
function Send() {
  const { user, userWallet } = UserItem()
  const { isDarkMode } = useThemeContext()
  const [selectedToken, setTokenSelected] = useState(null);


  return (
    <View
      className="relative pt-3 bg-grey dark:bg-dark h-full w-100 flex items-start justify-start flex-col gap-y-4"
    >
      <View className="w-full px-4 flex flex-row justify-start">
        <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
          <IconLibrary.back />
        </Pressable>
      </View>
      <View className=" flex-1 gap-y-2 flex-col justify-start items-center rounded-2xl w-11/12 py-2 m-auto">
        <View className="flex flex-row justify-between items-center gap-x-2  ">
          <View
            className=" flex flex-row items-center  gap-x-2 justify-start p-4 rounded-xl  text-start  w-full bg-white dark:bg-accent"
          >
            <IconLibrary.search />
            <TextInput
              style={{ fontFamily: "bold", fontSize: 15 }}
              // value={""}
              placeholder="Search"
              className="w-full text-black dark:text-white"
              placeholderTextColor={isDarkMode ? 'white' : 'black'}
              numberOfLines={100}
              onChangeText={(text) => {
              }}
            />
            {/* <CText className="">${userWallet.balance}</CText> */}
          </View>
        </View>

        <View className="bg-white dark:bg-accent rounded-xl overflow-hidden">
          {userWallet?.tokenAccounts.map((token: any, index: number) => (
            <View key={index}>
              <TouchableNativeFeedback
                background={TouchableNativeFeedback.Ripple('#971BB2', false)}
                onPress={() => { console.log("touched") }}
              >
                <View
                  className=" px-4 py-4  w-full  flex flex-row items-start justify-between text-[20px]"
                >
                  <View className="flex flex-row items-start gap-x-2 w-full">
                    <View className="h-14 w-14  overflow-hidden rounded-full">
                      <Image source={token?.image ?? require('@/assets/images/icon.png')} alt={token?.name} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                    </View>

                    <View className="text-[14px]">
                      <CText style={{ fontFamily: "bold" }} className="text-[18px]">
                        {token?.name || "?"}
                      </CText>
                      <CText style={{ fontFamily: "reg" }} className="text-[16px]">
                        {token?.balance < 1 ?
                          token?.balance?.toFixed(Math.min(token?.decimals, 5))
                          : token?.balance.toFixed(Math.min(token?.decimals, 3))
                        }
                        {" "}
                        {token.symbol}

                      </CText>
                    </View>
                  </View>
                </View>
              </TouchableNativeFeedback>
              <View className="bg-grey dark:bg-accent w-full p-[0.6]" />

            </View>
          ))}
        </View>
      </View>



    </View>
  );
}

export default Send

