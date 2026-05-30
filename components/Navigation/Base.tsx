import tracker from '@/utils/tracker'
import IconLibrary from '@/utils/icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import React from 'react'
import { Pressable, TouchableOpacity, View } from 'react-native'
import { usePIP } from "@/services/PIPService/PIPManager";
import { useAi } from "@/context/AiContext";
import { VOICE_VERIFICATION_ENABLED } from "@/utils/constant";

interface BASENAV {
  isSessionActive: boolean;
  startSession: () => void;
  stopSession: () => void;
  isAiActive?: boolean;
  showWallet?: boolean;
  setShowWallet: (showWallet: boolean) => void;
}

export const Base = ({
  isSessionActive,
  startSession,
  stopSession,
  isAiActive,
  setShowWallet,
  showWallet,
}: BASENAV) => {
  const { showPIP, isPIPActive } = usePIP();
  const {
    inputMode,
    isVoiceCommandRecording,
    voiceEnrolled,
  } = useAi();

  const handlePIPToggle = () => {
    if (isSessionActive) {
      showPIP();
    } else {
      // Start session and then show PIP
      startSession();
      setTimeout(() => showPIP(), 1000);
    }
  };

  if (inputMode === "chat") return null;

  const handlePrimaryPress = () => {
    tracker.buttons(showWallet ? "open_ai_chat" : "start_ai_session", 1);

    if (showWallet) {
      setShowWallet(false);
      return;
    }

    if (VOICE_VERIFICATION_ENABLED && voiceEnrolled === false) {
      router.push("/voicereg");
      return;
    }

    if (!isSessionActive) {
      startSession();
    }
  };

  return (
    <View className="absolute w-screen flex flex-row justify-center items-center bottom-10 px-2">
      <View className="w-fit gap-x-4 bg-[#E1E1E1]/60 dark:bg-accent2 p-2 h-[75] rounded-full flex flex-row justify-between items-center ">
        {/* <View className="h-[56] w-[56] border border-purple flex items-center justify-center rounded-full">
            <Ionicons name="wallet-outline" size={24} color="#971BB2" />
          </View> */}

        <TouchableOpacity
          onPress={() => {
            tracker.buttons("wallet", 1);
            setShowWallet && setShowWallet(true);
          }}
          className="h-[56] w-[56] border bg-[#666666] dark:bg-accent border-white dark:border-dark flex items-center justify-center rounded-full"
        >
          <IconLibrary.wallet />

          {/* <Ionicons name="color-palette-outline" size={24} color="white" /> */}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePrimaryPress}
          activeOpacity={0.85}
          className={`h-[100] w-[100] bg-grey dark:bg-accent rounded-full ${isVoiceCommandRecording ? "border-4 border-red-500" : ""}`}
        >
          <Image
            source={require("@/assets/images/ai.png")}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </TouchableOpacity>
        {isSessionActive ? (
          <TouchableOpacity
            onPress={() => {
              tracker.buttons("stop_ai", 1);
              stopSession();
            }}
            className="h-[56] w-[56] flex items-center justify-center rounded-full"
          >
            <IconLibrary.cancel color="red" size={30} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              tracker.buttons("conversations", 1);
              router.push("/dashboard/chat");
            }}
            className="h-[56] w-[56] flex items-center justify-center rounded-full"
          >
            <IconLibrary.chat />
          </TouchableOpacity>
        )}
        {/* <View className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <MaterialCommunityIcons name="web" size={24} color="black" />
          </View> */}
      </View>
    </View>
  );
};
