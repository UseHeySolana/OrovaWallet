import { useEffect, useRef, useState } from "react";
import { ScrollView, Pressable, TouchableNativeFeedback, RefreshControl, View } from "react-native";
import CText from "@/components/TextComp";
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from "expo-image";
import Buttons from "@/components/ButtonComp";

import UserItem from "@/misc/store/userstore";
import { copyItem } from "@/misc/helpers/functions";
import setUserItems from "../requests/dashboard";

import { router } from "expo-router";
import WalletItem from "@/misc/store/wallet";
import AppSettings from "@/misc/store/settingsstore";


const AiHelpers = [
  {
    title: "AI Assistant (Smart finance)",
    caption: "Smart Hedging & transaction analysis",
  },
  {
    title: " AI Assistant",
    caption: "Smart Ledging & transaction analysis"
  },
  {
    title: " AI Assistant",
    caption: "Smart Ledging & transaction analysis"
  }
]

/**
  * What should be done here
  * 1. Get User Tokens and Balance
  */
export default function Dashboard({ navigation }: any) {

  const [activeItems, setActiveItems] = useState([0, 1])
  const [activeTab, setActiveTab] = useState(0)

  const { user, userWallet, updateUserWallet, logout } = UserItem()
  const { network, setLoading } = AppSettings()
  const { publicKey } = WalletItem()
  const [refreshing, setRefreshing] = useState(false);
  const [update, setUpdate] = useState(0)


  useEffect(() => {

    const getUser = async () => {
      await setLoading(true)
      if (!user || !publicKey) return
      await setUserItems(user, updateUserWallet, publicKey, network);
      setLoading(false)
    }

    getUser();
  }, [user, network, updateUserWallet, publicKey, update])


  const onRefresh = async () => {
    setRefreshing(true);
    setUpdate(Math.random())
    setRefreshing(false);
  };
  return (
    <View
      className="pt-3 w-screen px-4 h-screen gap-y-3 "
    >
      {/* Top Icons */}
      <View className="flex  flex-row justify-between items-center">
        <View className="p-3  rounded-full bg-white">
          <Feather name="settings" size={16} color="black" />
        </View>
        <View className="bg-white p-3 rounded-3xl flex flex-row items-center gap-x-1">
          <View className="h-6 w-6  rounded-full">
            <Image source={require('@/assets/images/icon.png')} style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </View>
          <CText style={{ fontFamily: 'md' }} className="">@{user?.username}</CText>
        </View>
        <View className="p-3  rounded-full bg-white">
          <AntDesign name="scan1" size={16} color="black" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className=" min-h-[50px] gap-y-3">
          <View className="m-auto  w-full shadow-md bg-white rounded-3xl py-4">
            <View className="flex flex-row  justify-between items-center px-5 py-3">
              <View className="">
                <CText className="text-[45px]">
                  ${userWallet?.totalUsdBalance.toFixed(2)}
                </CText>
                <View>
                  <CText className="text-[18px]">Hide balance</CText>
                </View>
              </View>
              <View className="flex flex-row justify-center items-center gap-2">
                <Pressable onPress={async () => await copyItem(user?.walletAddress || "")} className="p-3  rounded-full bg-grey">
                  <Ionicons name="copy-outline" size={16} color="black" />
                </Pressable>
                <View className="p-3  rounded-full bg-grey">
                  <AntDesign name="qrcode" size={16} color="black" />
                </View>
              </View>
            </View>

            <View className="bg-grey w-full p-[0.6]" />

            <View className="flex flex-row gap-2 py-3 items-center px-4">
              <View className="w-[43%]">
                <Buttons buttonType="feedback" className="py-4 rounded-full" onPress={() => { logout(); router.dismissTo('/') }} type="primary" text="Send" icon={
                  <View className="rotate-[230deg]">
                    <AntDesign name="arrowdown" size={16} color="white" />
                  </View>
                } />
              </View>
              <View className="w-[43%]">
                <Buttons buttonType="feedback" className="py-4 rounded-full" onPress={() => { }} type="secondary" text="Buy"
                  icon={
                    <View className="rotate-[60deg]">
                      <AntDesign name="arrowdown" size={16} color="black" />
                    </View>
                  }
                />
              </View>
              <View className="w-[10%] flex justify-center items-center">
                <Pressable className="p-2 h-10 w-10 flex justify-center items-center  rounded-full bg-grey">
                  <FontAwesome6 name="arrows-rotate" size={16} color="gray" />
                </Pressable>
              </View>
            </View>

          </View>

          <View className="h-[90px] relative w-full">
            {AiHelpers.map((item, index) => {
              return (
                <View key={index} style={{
                  display: activeItems.includes(index) ? "flex" : "none",
                  position: "relative",
                  bottom: index * 70,
                  zIndex: index * -1,

                  width: `${100 - index * 4}%`
                }} className="h-[80px] m-auto" >

                  <View className="flex flex-row shadow justify-start items-center gap-3 p-6 rounded-2xl bg-white">
                    <View className="h-8 w-8 rounded-full">
                      <Image source={require('@/assets/images/icon.png')} style={{ width: "100%", height: "100%" }}
                        contentFit="contain"
                      />
                    </View>
                    <View>
                      <CText style={{ fontFamily: "bold" }} className="text-[18px]">{item.title}</CText>
                      <CText className="text-[14px]">{item.caption}</CText>
                  </View>

                  </View>
                  <Pressable className="py-2 px-3 absolute right-2 top-2 h-9 w-9 flex justify-center  items-center rounded-full bg-grey text-white" onPress={() => { }}>
                    <MaterialCommunityIcons name="greater-than" size={12} color="black" />
                  </Pressable>
                </View>
              )
            })}

          </View>

          <View className="w-full  pb-[60px] shadow-md m-auto bg-white overflow-hidden rounded-3xl">
            <View className="flex flex-row items-center justify-between">
              <TouchableNativeFeedback
                background={TouchableNativeFeedback.Ripple('#971BB2', false)}
                onPress={() => { }}>

                <View className="w-[50%] py-5 border-b-2 border-purple">
                  <CText style={{ fontFamily: "bold" }} className="text-[18px]  text-center">Tokens</CText>
                </View>
              </TouchableNativeFeedback>
              <TouchableNativeFeedback
                background={TouchableNativeFeedback.Ripple('#971BB2', false)}
                onPress={() => { }}>
                <View className="w-[50%] py-5 border-b-2 border-grey ">
                  <CText className="text-[18px] text-center">History</CText>
            </View>
              </TouchableNativeFeedback>

            </View>

            <View className="flex-1">
              {userWallet?.tokenAccounts?.map((token: any, index: number) => {
                return (
                  <TouchableNativeFeedback
                    key={index}
                    background={TouchableNativeFeedback.Ripple('#971BB2', false)}
                    onPress={() => { console.log("touched") }}
                  >
                    <>
                      <View
                        className=" px-4 py-4  w-full  flex flex-row items-start justify-between text-[20px]"
                      >
                        <View className="flex flex-row items-start gap-x-2">
                          <View className="h-14 w-14  overflow-hidden rounded-full">
                            <Image source={token?.image ?? require('@/assets/images/icon.png')} alt={token?.name} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                          </View>

                          <View className="text-[14px]">
                            <CText style={{ fontFamily: "bold" }} className="text-[24px]">
                              {token?.name || "?"}
                            </CText>
                            <CText style={{ fontFamily: "md" }} className="text-[18px]">
                              {token?.balance?.toFixed(Math.min(token?.decimals, 2))}

                            </CText>
                          </View>
                        </View>
                        <View className="flex flex-col justify-end">
                          <CText className="text-[14px]">
                            {token?.balance?.toFixed(Math.min(token?.decimals, 2))}
                          </CText>
                          <CText className="text-[10px]">
                            {token?.usdc_price
                              ? "$" + token?.usdc_price?.toFixed(2)
                              : ""}
                          </CText>
                        </View>
                      </View>
                      <View className="bg-grey w-full p-[0.6]" />
                    </>
                  </TouchableNativeFeedback>
                );
              })}



            </View>

            <View className="absolute bottom-5 w-full">
              <View className="bg-grey rounded-full  m-auto w-10/12 flex flex-row justify-center items-center gap-x-4 p-3">

                <FontAwesome name="sliders" size={14} color="black" />
                <CText>
                  Manage tokens
                </CText>
              </View>
            </View>

          </View>
        </View>

      </ScrollView>



      <View className="absolute w-screen bottom-5 px-2">

        <View className="w-full bg-[#E1E1E1] p-2 h-[75] rounded-full flex flex-row justify-between items-center ">

          <View className="h-[56] w-[56] border border-purple flex items-center justify-center rounded-full">
            <Ionicons name="wallet-outline" size={24} color="#971BB2" />
          </View>
          <View className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <Ionicons name="color-palette-outline" size={24} color="black" />

          </View>
          <View className="h-[100]  w-[100] bg-grey  p-3 rounded-full">
            <Image source={require('@/assets/images/ai.png')} style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </View>
          <View className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <FontAwesome6 name="arrows-rotate" size={16} color="black" />
          </View>
          <View className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <MaterialCommunityIcons name="web" size={24} color="black" />
          </View>

        </View>
      </View>


    </View>
  );
}


