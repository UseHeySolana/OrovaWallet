import tracker from '@/utils/tracker'
import IconLibrary from '@/utils/icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import Feather from "@expo/vector-icons/Feather";
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
  setShowWallet,
  showWallet,
}: BASENAV) => {
  const {
    sessionManager,
    inputMode,
    isVoiceCommandRecording,
    voiceEnrolled,
  } = useAi();
  const [speakerMuted, setSpeakerMuted] = React.useState(false);
  const [micMuted, setMicMuted] = React.useState(false);

  if (inputMode === "chat" && !showWallet) return null;

  const isAiScreenOpen = !showWallet;
  const shouldShowCancel = isAiScreenOpen && isSessionActive;
  const showAudioSessionControls = shouldShowCancel && inputMode === "audio";

  React.useEffect(() => {
    if (!isSessionActive) {
      setSpeakerMuted(false);
      setMicMuted(false);
    }
  }, [isSessionActive]);

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

  return (
    <View className="absolute right-4 bottom-10 flex flex-col items-center gap-y-3">
      {!showAudioSessionControls && (
        <TouchableOpacity
          onPress={() => {
            tracker.buttons("conversations", 1);
            router.push("/dashboard/chat");
          }}
          activeOpacity={0.85}
          className="h-[50] w-[50] bg-white/90 dark:bg-accent2 border border-white/70 dark:border-white/10 shadow flex items-center justify-center rounded-full"
        >
          <IconLibrary.chat size={20} />
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
  );
};
