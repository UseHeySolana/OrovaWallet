import tracker from '@/utils/tracker'
import IconLibrary from '@/utils/icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import React from 'react'
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native'
import Feather from "@expo/vector-icons/Feather";
import { useAi } from "@/context/AiContext";
import { VOICE_VERIFICATION_ENABLED } from "@/utils/constant";
import { useThemeContext } from "@/context/ThemeContext";

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
  setShowWallet,
  showWallet,
}: BASENAV) => {
  const {
    sessionManager,
    inputMode,
    isVoiceCommandRecording,
    voiceEnrolled,
  } = useAi();
  const { isDarkMode } = useThemeContext();
  const [speakerMuted, setSpeakerMuted] = React.useState(false);
  const [micMuted, setMicMuted] = React.useState(false);
  const bubbleIntro = React.useRef(new Animated.Value(0)).current;
  const bubblePulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!isSessionActive) {
      setSpeakerMuted(false);
      setMicMuted(false);
    }
  }, [isSessionActive]);

  const isAiScreenOpen = !showWallet;
  const shouldShowCancel = isAiScreenOpen && isSessionActive;
  const showAudioSessionControls = shouldShowCancel && inputMode === "audio";
  const showStartHint = isAiScreenOpen && !isSessionActive;
  const bubbleBackgroundColor = isDarkMode ? "#2A2440" : "#FFFFFF";

  React.useEffect(() => {
    if (!showStartHint) {
      bubbleIntro.setValue(0);
      bubblePulse.setValue(0);
      return undefined;
    }

    const intro = Animated.timing(bubbleIntro, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    });

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(bubblePulse, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bubblePulse, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ])
    );

    intro.start();
    pulse.start();

    return () => {
      intro.stop();
      pulse.stop();
    };
  }, [bubbleIntro, bubblePulse, showStartHint]);

  const handleSecondaryPress = () => {
    if (isAiScreenOpen) {
      tracker.buttons("open_wallet", 1);
      setShowWallet(true);
      return;
    }

    tracker.buttons("conversations", 1);
    router.push("/dashboard/chat");
  };

  const handleToggleSpeaker = () => {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    if (typeof sessionManager?.muteSpeaker === "function") {
      sessionManager.muteSpeaker(next);
    }
  };

  const handleToggleMic = () => {
    const next = !micMuted;
    setMicMuted(next);
    if (typeof sessionManager?.muteMic === "function") {
      sessionManager.muteMic(next);
    }
  };

  const handlePrimaryPress = () => {
    if (shouldShowCancel) {
      tracker.buttons("stop_ai", 1);
      stopSession();
      return;
    }

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

  if (inputMode === "chat" && !showWallet) return null;

  return (
    <View className="absolute right-4 pe-3 bottom-10 flex flex-col items-end gap-y-3">
      {!showAudioSessionControls && (
        <TouchableOpacity
          onPress={handleSecondaryPress}
          activeOpacity={0.85}
          className="h-[50] w-[50] bg-white/90 dark:bg-accent2 border border-white/70 dark:border-white/10 shadow flex items-center justify-center rounded-full"
        >
          {isAiScreenOpen ? (
            <IconLibrary.wallet size={22} />
          ) : (
            <IconLibrary.chat size={20} />
          )}
        </TouchableOpacity>
      )}

      {showAudioSessionControls && (
        <>
          <TouchableOpacity
            onPress={handleToggleSpeaker}
            activeOpacity={0.85}
            className={`h-[56] w-[56] border border-white/70 dark:border-white/10 shadow flex items-center justify-center rounded-full ${speakerMuted ? "bg-red-500" : "bg-white/90 dark:bg-accent2"
              }`}
          >
            <Feather
              name={speakerMuted ? "volume-x" : "volume-2"}
              size={22}
              color={speakerMuted ? "#fff" : "#971BB2"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleMic}
            activeOpacity={0.85}
            className={`h-[56] w-[56] border border-white/70 dark:border-white/10 shadow flex items-center justify-center rounded-full ${micMuted ? "bg-red-500" : "bg-white/90 dark:bg-accent2"
              }`}
          >
            <Feather
              name={micMuted ? "mic-off" : "mic"}
              size={22}
              color={micMuted ? "#fff" : "#971BB2"}
            />
          </TouchableOpacity>
        </>
      )}

      <View className="flex-row items-center">
        {showStartHint && (
          <Animated.View
            style={{
              opacity: bubbleIntro,
              transform: [
                {
                  translateX: bubbleIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
                {
                  scale: bubblePulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.04],
                  }),
                },
              ],
            }}
          >
            <TouchableOpacity
              onPress={handlePrimaryPress}
              activeOpacity={0.85}
              className="mr-1 flex-row items-center"
            >
              <View
                className="px-4 py-2 rounded-l-2xl rounded-t-2xl border border-white/70 dark:border-white/10 shadow"
                style={{ backgroundColor: bubbleBackgroundColor }}
              >
                <Text className="text-sm font-semibold text-purple dark:text-white">
                  Start
                </Text>
              </View>
              {/* <View
                style={{
                  width: 0,
                  height: 0,
                  borderTopWidth: 8,
                  borderBottomWidth: 8,
                  borderLeftWidth: 10,
                  borderTopColor: "transparent",
                  borderBottomColor: "transparent",
                  borderLeftColor: bubbleBackgroundColor,
                  marginLeft: -1,
                }}
              /> */}
            </TouchableOpacity>
          </Animated.View>
        )}

        <TouchableOpacity
          onPress={handlePrimaryPress}
          activeOpacity={0.85}
          className={`rounded-full shadow flex items-center justify-center ${shouldShowCancel ? "h-[56] w-[56]" : "h-[72] w-[72]"
            } ${shouldShowCancel ? "bg-red-500" : "bg-grey dark:bg-accent"
            } ${isVoiceCommandRecording ? "border-4 border-red-500" : ""}`}
        >
          {shouldShowCancel ? (
            <IconLibrary.cancel color="white" size={28} />
          ) : (
            <Image
              source={require("@/assets/images/ai.png")}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
