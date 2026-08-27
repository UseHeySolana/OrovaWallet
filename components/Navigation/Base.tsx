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
import { MicWaveform } from "@/components/Navigation/MicWaveform";

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
    isPushToTalkRecording,
    startPushToTalk,
    stopPushToTalk,
    voiceEnrolled,
    resumeConversationId,
    setResumeConversationId,
  } = useAi();
  const { isDarkMode } = useThemeContext();
  const [speakerMuted, setSpeakerMuted] = React.useState(false);
  const [micMuted, setMicMuted] = React.useState(false);
  const bubbleIntro = React.useRef(new Animated.Value(0)).current;
  const bubblePulse = React.useRef(new Animated.Value(0)).current;
  const micLevelAnim = React.useRef(new Animated.Value(0)).current;
  const useHoldToTalk = !VOICE_VERIFICATION_ENABLED;

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
  const canContinueConversation = Boolean(resumeConversationId);
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

  React.useEffect(() => {
    if (!isPushToTalkRecording) {
      micLevelAnim.setValue(0);
    }
  }, [isPushToTalkRecording, micLevelAnim]);

  const handleMicLevel = React.useCallback(
    (level: number) => {
      Animated.timing(micLevelAnim, {
        toValue: level,
        duration: 60,
        useNativeDriver: true,
      }).start();
    },
    [micLevelAnim]
  );

  const handleSecondaryPress = () => {
    if (isAiScreenOpen) {
      tracker.buttons("open_wallet", 1);
      setShowWallet(true);
      return;
    }

    tracker.buttons("conversations", 1);
    // Opening the list clears sticky resume so "back" without picking
    // starts a fresh chat; selecting a row sets resume again.
    setResumeConversationId(null);
    router.setParams({ convoId: null });
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

  const handleTalkPressIn = () => {
    tracker.buttons("push_to_talk_start", 1);
    void startPushToTalk();
  };

  const handleTalkPressOut = () => {
    tracker.buttons("push_to_talk_stop", 1);
    void stopPushToTalk();
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
          {useHoldToTalk && (
            isPushToTalkRecording ? (
              <MicWaveform
                active={isPushToTalkRecording}
                sessionManager={sessionManager}
                onLevel={handleMicLevel}
              />
            ) : (
              <View
                className="px-3 py-1.5 rounded-full border border-white/70 dark:border-white/10 shadow"
                style={{ backgroundColor: bubbleBackgroundColor }}
              >
                <Text className="text-xs font-semibold text-purple dark:text-white">
                  Hold to talk
                </Text>
              </View>
            )
          )}

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

          {useHoldToTalk ? (
            <Animated.View
              style={{
                transform: [
                  {
                    scale: micLevelAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.14],
                    }),
                  },
                ],
              }}
            >
              <TouchableOpacity
                onPressIn={handleTalkPressIn}
                onPressOut={handleTalkPressOut}
                delayPressIn={0}
                activeOpacity={0.9}
                className={`h-[64] w-[64] border-2 shadow flex items-center justify-center rounded-full ${isPushToTalkRecording
                  ? "bg-red-500 border-red-300"
                  : "bg-[#971BB2] border-white/70 dark:border-white/10"
                  }`}
              >
                <Feather
                  name="mic"
                  size={26}
                  color="#fff"
                />
              </TouchableOpacity>
            </Animated.View>
          ) : (
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
          )}
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
                  {canContinueConversation ? "Continue" : "Start"}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        <TouchableOpacity
          onPress={handlePrimaryPress}
          activeOpacity={0.85}
          className={`rounded-full shadow flex items-center justify-center ${shouldShowCancel ? "h-[56] w-[56]" : "h-[72] w-[72]"
            } ${shouldShowCancel ? "bg-red-500" : "bg-grey dark:bg-accent"
            } ${isVoiceCommandRecording || isPushToTalkRecording ? "border-4 border-red-500" : ""}`}
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
