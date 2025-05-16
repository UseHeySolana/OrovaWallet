import { useCallback, useEffect, useRef, useState } from "react";
import LottieView from 'lottie-react-native';
import { ScrollView, TouchableNativeFeedback, RefreshControl, View, Alert, TouchableOpacity, Pressable, Linking, TouchableHighlight } from "react-native";
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
import { copyItem } from "@/misc/helpers/miscfunctions.ts";
import setUserItems, { api_key } from "../requests/dashboard";
import { router } from "expo-router";
import WalletItem from "@/misc/store/wallet";
import AppSettings from "@/misc/store/settingsstore";
import { useAi } from "@/misc/context/AiContext";

import { Base } from "@/components/Navigation/Base";
import { useThemeContext } from "@/misc/context/ThemeContext";
import Convo, { MessageType } from "@/misc/store/conversation";
import { scale } from "react-native-size-matters";
import { keypairSign, openURL, showToast, signTransactions } from "@/misc/helpers/miscfunctions.ts/extrafunctions";
import { transferSol, transferToken } from "@/misc/helpers/transfers";
import IconLibrary from "@/misc/helpers/icons";
import { purchaseAirtime } from "@/misc/helpers/db";


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

const colors = {
  loading: {
    color1: "#971BB2", // main purple
    color2: "#D98BEA", // lighter purple for shimmer effect
  },
  aispeaking: {
    color1: "#4B00E0", // electric violet
    color2: "#00F0FF", // neon cyan
  },
  human: {
    color1: "#1BB296", // teal (fresh, natural contrast to purple)
    color2: "#A3F3E4", // minty highlight for friendliness
  }
}
/**
  * What should be done here
  * 1. Get User Tokens and Balance
  * 2. AI interactions can also be done Here
  */
export default function Dashboard() {
  const [activeItems, setActiveItems] = useState([0, 1])
  const { messages, getConversationMessages, conversations } = Convo()
  const [activeTab, setActiveTab] = useState('tokens')
  const { user, userWallet, updateUserWallet, logout } = UserItem();
  const { network, setLoading, aiName } = AppSettings();
  const { connection, sessionManager, isSessionActive, startSession, stopSession, currentMode, conversationId } = useAi()
  const { publicKey, keypair } = WalletItem()
  const [refreshing, setRefreshing] = useState(false);
  const [update, setUpdate] = useState(0)
  const animation = useRef<LottieView>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const [showWallet, setShowWallet] = useState(false)
  const { isDarkMode } = useThemeContext()

  const [message, setMessage] = useState<MessageType[]>([])


  useEffect(() => {
    // console.log(conversations)
    // const messageItem = getConversationMessages('1747380640683') || [];
    const messageItem = getConversationMessages(conversationId) || [];

    setMessage(messageItem);

  }, [conversationId, messages])

  useEffect(() => {
    if (currentMode === "aispeaking" || currentMode === "human") {
      animation.current?.play()
    } else if (currentMode === "loading") {
      animation.current?.pause()
    }

  }, [currentMode])

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
    setShowWallet(false)
    setRefreshing(false);
  };

  const startStreamingSession = async () => {
    if (!sessionManager) return
    startSession()
    setShowWallet(false)
  }

  const stopStreamingSession = async () => {
    if (!sessionManager) return
    stopSession()
    setShowWallet(true)
  }

  const sendMessage = async () => {
    if (!sessionManager) return
    sessionManager?.sendTextMessage("this is new")
  }





  return (
    <View
      className="pt-3 pb-2 w-screen  px-4 h-screen gap-y-4 bg-grey dark:bg-dark "
    >
      <View className="flex  flex-row justify-between items-center">
        {/* <TouchableOpacity onPress={() => router.push('/settings')} className="p-3  rounded-full bg-white dark:bg-accent ">
          <Feather name="settings" size={16} color={isDarkMode ? "white" : "black"} />
        </TouchableOpacity> */}
        <View className="bg-white dark:bg-accent p-3 rounded-3xl flex flex-row items-center gap-x-1">
          <View className="h-6 w-6  rounded-full">
            <Image source={require('@/assets/images/icon.png')} style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </View>
          <CText style={{ fontFamily: 'md' }} className="text-dark dark:text-white">@{user?.username}</CText>
        </View>
        <View className="flex flex-row gap-x-2">
          <TouchableOpacity onPress={() => router.push('/settings')} className="p-3  rounded-full bg-white dark:bg-accent ">
            <Feather name="settings" size={16} color={isDarkMode ? "white" : "black"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/dashboard/scan')} className="p-3  rounded-full bg-white dark:bg-accent">
            <AntDesign name="scan1" size={16} color={isDarkMode ? "white" : "black"} />
          </TouchableOpacity>
        </View>

      </View>
      {showWallet ?
        <>
          {/* Top Icons */}
          <ScrollView
            className=""
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"

            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View className=" min-h-[50px] gap-y-3">
              <View className="m-auto  w-full shadow-md bg-white dark:bg-transparent rounded-3xl py-4">
                <View className="flex flex-row  justify-between items-center px-5 py-3">
                  <View className="">
                    <View>
                      <CText className="text-[12px]">Wallet balance</CText>
                    </View>
                    <CText className="text-[45px]">
                      ${userWallet?.totalUsdBalance.toFixed(2)}
                    </CText>

                  </View>
                  <View className="flex flex-row justify-center items-center gap-2">
                    <TouchableOpacity onPress={async () => await copyItem(publicKey?.toString() || "")} className="p-3  rounded-full bg-grey dark:bg-accent2">
                      <Ionicons name="copy-outline" size={16} color={isDarkMode ? "white" : "black"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/dashboard/qrcode')} className="p-3  rounded-full bg-grey dark:bg-accent2">
                      <AntDesign name="qrcode" size={16} color={isDarkMode ? "white" : "black"} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="bg-grey dark:bg-dark w-full p-[0.6]" />

                <View className="flex flex-row gap-2 py-3 items-center justify-between px-4">
                  <View className="w-[40%]">
                    <Buttons buttonType="feedback" className="py-4 rounded-full" onPress={() => {
                      //  router.push('/dashboard/send') 
                      showToast("Kindly Use Voice to send tokens")
                    }} type="secondary" text="Send" icon={
                      <View className="rotate-[230deg]">
                        <AntDesign name="arrowdown" size={16} color={isDarkMode ? "white" : "black"} />
                      </View>
                    } />
                  </View>
                  <View className="w-[40%]">
                    <Buttons buttonType="feedback" className="py-4 rounded-full" onPress={() => {
                      showToast("Kindly Use Voice to send tokens")
                    }} type="secondary" text="Receive"
                      icon={
                        <View className="rotate-[40deg]">
                          <AntDesign name="arrowdown" size={16} color={isDarkMode ? "white" : "black"} />
                        </View>
                      }
                    />
                  </View>
                  <View className="w-[45px] h-[45px] rounded-full  bg-grey dark:bg-accent2 flex justify-center items-center">
                    <TouchableOpacity className="p-2 flex justify-center items-center">
                      <FontAwesome6 name="arrows-rotate" size={16} color={isDarkMode ? "white" : "black"} />
                    </TouchableOpacity>
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

                      <View className="flex flex-row shadow justify-start items-center gap-3 p-6 rounded-2xl bg-white dark:bg-accent">
                        <View className="h-8 w-8 rounded-full">
                          <Image source={require('@/assets/images/icon.png')} style={{ width: "100%", height: "100%" }}
                            contentFit="contain"
                          />
                        </View>
                        <View>
                          <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">{item.title}</CText>
                          <CText className="text-[1rem]">{item.caption}</CText>
                        </View>

                      </View>
                      <TouchableOpacity className="py-2 px-3 absolute right-2 top-2 h-9 w-9 flex justify-center  items-center rounded-full bg-grey dark:bg-accent2 text-white" onPress={() => { }}>
                        <MaterialCommunityIcons name="greater-than" size={12} color={isDarkMode ? "white" : "black"} />
                      </TouchableOpacity>
                    </View>
                  )
                })}

              </View>

              <View className="w-full min-h-[400px]  pb-[60px] shadow-md m-auto bg-white dark:bg-accent overflow-hidden rounded-3xl">
                <View className="flex flex-row items-center justify-between">
                  <TouchableNativeFeedback
                    background={TouchableNativeFeedback.Ripple('#971BB2', false)}
                    onPress={() => setActiveTab('tokens')}>

                    <View className={`w-[50%] py-5 border-b-2 ${activeTab == "tokens" ? "border-purple" : "border-grey"} `}>
                      <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]  text-center">Tokens</CText>
                    </View>
                  </TouchableNativeFeedback>
                  <TouchableNativeFeedback
                    background={TouchableNativeFeedback.Ripple('#971BB2', false)}
                    onPress={() => setActiveTab('history')}>
                    <View className={`w-[50%] py-5 border-b-2 ${activeTab == "history" ? "border-purple" : "border-grey dark:border-dark"} `}>

                      <CText className="text-[1.1rem] text-center">History</CText>
                    </View>
                  </TouchableNativeFeedback>

                </View>

                {activeTab == "tokens" ?

                  <View className="flex-1">

                    <View className="py-5 w-full">
                      <TouchableOpacity className="bg-grey dark:bg-accent2 rounded-full  m-auto w-10/12 flex flex-row justify-center items-center gap-x-4 p-3">
                        <FontAwesome name="sliders" size={14} color="black" />
                        <CText>
                          Manage tokens
                        </CText>
                      </TouchableOpacity>
                    </View>
                    {userWallet?.tokenAccounts?.map((token: any, index: number) => {
                      return (
                        <View key={index}>
                          <TouchableNativeFeedback
                            key={index}
                            background={TouchableNativeFeedback.Ripple('#971BB2', false)}
                            onPress={() => {
                              router.push({
                                pathname: '/dashboard/tokeninfo',
                                params: { mint: token.mint },
                              });
                            }}
                          >
                            <View
                              className=" px-4 py-4  w-full  flex flex-row items-start justify-between text-[1.14rem]"
                            >
                              <View className="flex flex-row items-start gap-x-2">
                                <View
                                  style={{
                                    width: scale(30),
                                    height: scale(30),

                                  }}

                                  className="overflow-hidden rounded-full">
                                  <Image source={token?.image ?? require('@/assets/images/icon.png')} alt={token?.name} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                                </View>

                                <View className="text-[14px]">
                                  <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
                                    {token?.name || "?"}
                                  </CText>
                                  <CText style={{ fontFamily: "reg" }} className="text-[1rem]">
                                    {token?.balance < 1 ?
                                      token?.balance?.toFixed(Math.min(token?.decimals, 5))
                                      : token?.balance.toFixed(Math.min(token?.decimals, 3))
                                    }
                                  </CText>
                                </View>
                              </View>
                              <View className="flex flex-col justify-end">
                                {/* <CText className="text-[14px]">
                            {token?.balance?.toFixed(Math.min(token?.decimals, 2))}
                          </CText> */}
                                <CText style={{ fontFamily: "bold" }} className="text-[16px]">
                                  {token?.usdc_price
                                    ? "$" + token?.usdc_price?.toFixed(2)
                                    : ""}
                                </CText>
                              </View>
                            </View>
                          </TouchableNativeFeedback>
                          <View className="bg-grey dark:bg-dark w-full p-[0.6]" />
                        </View>

                      );
                    })}



                  </View>

                  :

                  <View className="flex-1 justify-center items-center">

                    <CText>
                      No Transaction History yet!
                    </CText>
                  </View>

                }


              </View>
            </View>

          </ScrollView>

        </>
        :
        <View className="flex-1 justify-start py-2  rounded-3xl overflow-hidden">
          {message.length > 0 &&

            <View className="h-[36rem] z-50">
              <ScrollView
                ref={scrollViewRef}
                className=" py-2 relative h-[36rem] gap-y-4"
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >

                {message.map((item: any, index: number) => {
                  const isSystem = item.role === "system";
                  const toolCall = item.role === "tool";
                  const isUser = item.role === 'user';
                  const params = item?.tool?.arguments?.parameter && Object.keys(item.tool?.arguments?.parameter) || item.tool?.arguments && Object.keys(item.tool?.arguments) || []
                  return (
                    <View key={index + item.id} className="mb-3 relative">
                      {toolCall ? (
                        <>
                          {/* Tool Call View */}
                          <View className="py-4 shadow-sm px-4 flex flex-col items-start justify-center text-[1.14rem] bg-white dark:bg-dark dark:border border-accent rounded-xl gap-y-3">
                            {/* Header */}
                            <View className="flex flex-row items-center justify-between w-full bg-white dark:bg-accent2 p-1 rounded-full gap-x-3">
                              <View className="flex-1 flex-row items-center gap-x-2 bg-grey dark:bg-accent p-2 rounded-full ">
                                <Image
                                  source={require('@/assets/images/icon.png')}
                                  style={{ width: 30, height: 30 }}
                                  contentFit="contain"
                                  className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
                                />
                                <View>
                                  {item.tool ?
                                    <CText className="text-[1.23rem]" style={{ fontFamily: "bold" }}>

                                      {item.tool?.arguments?.owner ? item?.tool?.arguments?.owner : aiName}
                                    </CText>
                                    :
                                    <CText className="text-[1.23rem]" style={{ fontFamily: "bold" }}>

                                      {item?.tool?.owner ? item?.tool?.owner : aiName}
                                    </CText>

                                  }
                                  <CText>Tool Used</CText>

                                </View>
                              </View>

                              <View>
                                <View className="bg-grey dark:bg-accent p-2 w-10 h-10 rounded-full">
                                  <Image
                                    source={
                                      item.tool?.status == 'pending'
                                        ? require('@/assets/toolstatus/pending.png')
                                        : item.tool?.status == 'complete'
                                          ? require('@/assets/toolstatus/complete.png')
                                          : require('@/assets/toolstatus/failed.png')
                                    }
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="contain"
                                    className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
                                  />
                                </View>
                              </View>
                            </View>

                            {/* Params and Link */}
                            <View className="bg-white z- dark:bg-accent2 p-3 rounded-xl w-full">
                              <CText className="uppercase text-[1.23rem]" style={{ fontFamily: "bold" }}>

                                {item?.tool?.arguments?.tool ?
                                  item?.tool?.arguments?.tool?.replace('_', ' ').replace('-', ' ') :
                                  item?.tool?.action?.replace('_', ' ').replace('-', ' ')
                                }


                              </CText>
                              <View className="p-2 flex-1 flex-row justify-between">
                                <View>

                                  {params?.map((param: any, index: number) => (
                                    <View key={index} className="flex flex-row items-center justify-start gap-x-4">
                                      <CText className="text-[1rem] uppercase">{param}</CText>
                                      <CText className="text-[1rem]">
                                        {item?.tool?.arguments.parameter ?
                                          item.tool.arguments?.parameter[param]
                                          :
                                          item.tool.arguments[param]

                                        }</CText>
                                    </View>
                                  ))}
                                </View>


                                {item?.tool?.link && (
                                  <TouchableOpacity
                                    style={{
                                      zIndex: 99999999,
                                    }}
                                    onPress={() => openURL(item?.tool?.link)} className="p-3">
                                    <IconLibrary.external />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        </>
                      ) : (
                        <View
                          className={`w-full flex-col gap-y-2 mb-2 ${isSystem ? "justify-start" : "justify-end"}`}
                        >
                          <View className="flex flex-row items-center gap-x-2 ">
                            <Image
                              source={require('@/assets/images/ai.png')}
                              style={{ width: 30, height: 30 }}
                              contentFit="contain"
                              className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
                            />
                            <CText className="text-[12px]" style={{ fontFamily: "bold" }}>
                              {isSystem ? aiName : `@${user?.username}`}
                            </CText>
                          </View>
                          <View
                            className={`bg-white dark:bg-black p-2 rounded-b-xl rounded-tr-xl dark:border border-accent2 w-[70%] gap-y-2 ${isSystem ? "ml-2" : "mr-2"}`}
                          >
                            <View className="bg-grey dark:bg-accent p-2 rounded-lg">
                              <CText className="text-[12px]">{item.content}</CText>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}

              </ScrollView>
            </View>

          }

          <View className="h-full w-full absolute z-1">

            <LottieView
              autoPlay={true}
              loop
              speed={10}
              ref={animation}
              style={{
                position: "absolute",
                bottom: -10,
                // zIndex: 1,
                width: 1000,
                height: 500,

              }}
              resizeMode="cover"
              colorFilters={[
                {
                  keypath: "Shape Layer 2",
                  color: colors[currentMode].color1,
                },
                {
                  keypath: "Shape Layer 1",
                  color: colors[currentMode].color2,
                },
              ]}
              source={require('@/assets/anim/lower.json')}
            />
          </View>

        </View>
      }


      <Base showWallet={showWallet} setShowWallet={setShowWallet} stopSession={stopStreamingSession} startSession={startStreamingSession} isSessionActive={isSessionActive} />

    </View >
  );
}


