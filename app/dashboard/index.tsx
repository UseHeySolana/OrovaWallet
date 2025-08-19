import React, { useEffect, useRef, useState } from "react";
import LottieView from "lottie-react-native";
import { ScrollView, View, TouchableOpacity } from "react-native";
import CText from "@/components/TextComp";
import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import UserItem from "@/utils/store/userstore.store";
import setUserItems from "../requests/dashboard";
import { router, useLocalSearchParams } from "expo-router";
import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { useAi } from "@/context/AiContext";

import { Base } from "@/components/commons/Navigation/Base";
import { useThemeContext } from "@/context/ThemeContext";
import Convo, { MessageType } from "@/utils/store/conversation.store";
import { toolRouter } from "@/libs/tool-implemetation/toolsregistry";
  import SetPin from "@/components/commons/Sheets/SetPinSheet";
  import WalletScreen from "@/app/dashboard/components/DashboardComponents/WalletScreen";
  import ChatInterface from "@/app/dashboard/components/DashboardComponents/Chatinterface";
  import ToolsItem from "@/utils/store/toolsitems.store";
  import QuickActions from "@/services/WidgetService/QuickActions";

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
  },
};
/**
 * What should be done here
 * 1. Get User Tokens and Balance
 * 2. AI interactions can also be done Here
 */
export default function Dashboard() {
  const { convoId } = useLocalSearchParams();
  const { messages, getConversationMessages } = Convo();
  const { user, updateUserWallet } = UserItem();
  const { network, setLoading, pin } = AppSettings();
  const {
    sessionManager,
    isSessionActive,
    startSession,
    stopSession,
    currentMode,
    conversationId,
  } = useAi();
  const { publicKey } = WalletItem();
  const [refreshing, setRefreshing] = useState(false);
  const [update, setUpdate] = useState(0);
  const animation = useRef<LottieView>(null);

  const [showWallet, setShowWallet] = useState(false);
  const { isDarkMode } = useThemeContext();

  const [message, setMessage] = useState<MessageType[]>([]);
  const [setPinOpen, setSetPinOpen] = useState(false);

  useEffect(() => {
    console.log(
      ToolsItem.getState()
        .getToolParameters("Crossmint", "tracking email")[0]
        ?.value.toLowerCase()
    );
  }, []);

  useEffect(() => {
    if (pin.length > 0) {
      setSetPinOpen(false);
    } else {
      setSetPinOpen(true);
    }
  }, [pin]);

  useEffect(() => {
    if (conversationId !== "") {
      const messageItem = getConversationMessages(conversationId) || [];
      setMessage(messageItem);
    } else if (convoId || !(convoId != undefined)) {
      const messageItem = getConversationMessages(convoId as string) || [];
      setMessage(messageItem);
    }
  }, [conversationId, messages, convoId]);

  useEffect(() => {
    if (currentMode === "aispeaking" || currentMode === "human") {
      animation.current?.play();
    } else if (currentMode === "loading") {
      animation.current?.pause();
    }
  }, [currentMode]);

  useEffect(() => {
    if (sessionManager) {
      const tools = toolRouter(sessionManager);
    }
  }, [sessionManager]);

  useEffect(() => {
    const getUser = async () => {
      await setLoading(true);
      if (!user || !publicKey) return;
      await setUserItems(user, updateUserWallet, publicKey, network);
      setLoading(false);
    };

    getUser();
  }, [user, network, updateUserWallet, publicKey, update]);

  const onRefresh = async () => {
    setRefreshing(true);
    setUpdate(Math.random());
    setShowWallet(false);
    setRefreshing(false);
  };

  const startStreamingSession = async () => {
    if (!sessionManager) return;
    startSession();
    setShowWallet(false);
    router.setParams({
      convoId: null,
    });
  };

  const stopStreamingSession = async () => {
    if (!sessionManager) return;
    stopSession();
    setShowWallet(true);
  };

  return (
    <View className="flex-1 pt-3 pb-2 w-screen  px-4 h-screen gap-y-4 bg-grey dark:bg-dark ">
      <View className="flex  flex-row justify-between items-center">
        <View className="bg-white dark:bg-accent p-3 rounded-3xl flex flex-row items-center gap-x-1">
          <View className="h-6 w-6  rounded-full">
            <Image
              source={require("@/assets/images/ballicon.png")}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </View>
          <CText
            style={{ fontFamily: "md" }}
            className="text-dark dark:text-white"
          >
            @{user?.username}
          </CText>
        </View>
        <View className="flex flex-row gap-x-2">
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            className="p-3  rounded-full bg-white dark:bg-accent "
          >
            <Feather
              name="settings"
              size={16}
              color={isDarkMode ? "white" : "black"}
            />
          </TouchableOpacity>
          {/* <TouchableOpacity onPress={() => router.push('/dashboard/scan')} className="p-3  rounded-full bg-white dark:bg-accent">
            <AntDesign name="scan1" size={16} color={isDarkMode ? "white" : "black"} />
          </TouchableOpacity> */}
        </View>
      </View>
      {showWallet ? (
        <WalletScreen onRefresh={onRefresh} refreshing={refreshing} />
      ) : (
        <>
          <ChatInterface messages={message} />
          <QuickActions showInDashboard={false} />
        </>
      )}
      <Base
        showWallet={showWallet}
        setShowWallet={setShowWallet}
        stopSession={stopStreamingSession}
        startSession={startStreamingSession}
        isSessionActive={isSessionActive}
      />

      <SetPin open={setPinOpen} setOpen={setSetPinOpen} usage="first-time" />

      {/* <Base showWallet={showWallet} setShowWallet={setShowWallet} stopSession={stopStreamingSession} startSession={testFunctions} isSessionActive={isSessionActive} /> */}
    </View>
  );
}
