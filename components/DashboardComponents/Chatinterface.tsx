import React, { useRef, useState } from "react";
import { useThemeContext } from "@/context/ThemeContext";
import LottieView from "lottie-react-native";

import {
  Platform,
  ScrollView,
  TextInput,
  View,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import ToolItem from "@/components/ChatItems/ToolItem";
import ChatBox from "@/components/ChatItems/ChatBox";
import AppSettings from "@/utils/store/settingsstore.store";
import { useAi } from "@/context/AiContext";
import { VOICE_VERIFICATION_ENABLED } from "@/utils/constant";
import type { VoiceVerificationDebugInfo } from "@/libs/voiceinfra/VerifiedVoiceStream";
import { MessageType } from "@/utils/store/conversation.store";
import { BlurView } from "expo-blur";
import UserItem from "@/utils/store/userstore.store";
import CText from "@/components/TextComp";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";

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

interface ChatInterfaceProps {
  messages: MessageType[];
}

function formatPercent(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatVoiceVerificationDebug(info: VoiceVerificationDebugInfo): string {
  const lines: string[] = [`Sample #${info.utteranceId} · ${info.phase}`];

  if (info.phase === "hearing" && typeof info.rms === "number") {
    lines.push(`Audio level (RMS): ${info.rms}`);
  }

  if (info.phase === "verifying") {
    if (typeof info.durationSeconds === "number") {
      lines.push(`Captured: ${info.durationSeconds}s`);
    }
    if (typeof info.bytes === "number") {
      lines.push(`Bytes: ${info.bytes}`);
    }
  }

  if (info.source) {
    lines.push(`Path: ${info.source}`);
  }

  if (info.phase === "result" || info.phase === "error") {
    if (typeof info.verified === "boolean") {
      lines.push(`Verified: ${info.verified ? "yes" : "no"}`);
    }
    if (typeof info.confidence === "number") {
      const thresholdHint =
        typeof info.threshold === "number"
          ? ` (need ${formatPercent(info.threshold)})`
          : "";
      lines.push(`Confidence: ${formatPercent(info.confidence)}${thresholdHint}`);
    }
    if (
      typeof info.secondary_confidence === "number" &&
      typeof info.secondary_threshold === "number"
    ) {
      lines.push(
        `Secondary: ${formatPercent(info.secondary_confidence)} (need ${formatPercent(info.secondary_threshold)})`
      );
    }
    if (Array.isArray(info.scores) && info.scores.length > 0) {
      lines.push(`Scores: ${info.scores.map((score) => formatPercent(score)).join(", ")}`);
    }
    if (info.rejection_reason) {
      lines.push(`Reason: ${info.rejection_reason}`);
    }
    if (info.message) {
      lines.push(info.message);
    }
    if (info.error) {
      lines.push(`Error: ${info.error}`);
    }
  }

  return lines.join("\n");
}

function formatChatTranscript(messages: MessageType[], aiName: string, username?: string) {
  return messages
    .map((message) => {
      const speaker =
        message.role === "user" ? `@${username ?? "user"}` : message.role === "tool" ? "Tool" : aiName;
      const timestamp = Number.isFinite(message.timestamp)
        ? new Date(message.timestamp).toLocaleString()
        : "Unknown time";
      const content = message.content?.trim() || "[empty message]";
      const toolSummary =
        message.tool?.action && message.tool?.status
          ? `\nTool: ${message.tool.owner ? `${message.tool.owner}.` : ""}${message.tool.action} (${message.tool.status})`
          : "";

      return `[${timestamp}] ${speaker}: ${content}${toolSummary}`;
    })
    .join("\n\n");
}

export default function ChatInterface({ messages }: ChatInterfaceProps) {
  const { isDarkMode } = useThemeContext();

  const { aiName, setToast } = AppSettings();
  const { user } = UserItem();
  const animation = useRef<LottieView>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  const {
    sessionManager,
    isSessionActive,
    startSession,
    stopSession,
    currentMode,
    inputMode,
    setInputMode,
    sendChatMessage,
    isVoiceCommandRecording,
    voiceEnrolled,
    voiceGateStatus,
    voiceVerificationDebug,
    startVoiceCommand,
    stopVoiceCommand,
  } = useAi();

  const [chatInput, setChatInput] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const voiceRecordingRef = useRef(isVoiceCommandRecording);

  React.useEffect(() => {
    voiceRecordingRef.current = isVoiceCommandRecording;
  }, [isVoiceCommandRecording]);

  React.useEffect(() => {
    if (!VOICE_VERIFICATION_ENABLED) return;
    if (inputMode === "audio" && isSessionActive) return;
    if (voiceRecordingRef.current) {
      void stopVoiceCommand({ silentFailure: true });
    }
  }, [inputMode, isSessionActive, stopVoiceCommand]);

  React.useEffect(() => {
    if (!VOICE_VERIFICATION_ENABLED) return;
    if (
      inputMode !== "audio" ||
      voiceEnrolled !== true ||
      !isSessionActive ||
      isVoiceCommandRecording
    ) {
      return;
    }

    void startVoiceCommand();
  }, [
    inputMode,
    isSessionActive,
    isVoiceCommandRecording,
    startVoiceCommand,
    voiceEnrolled,
  ]);

  // Push content up by keyboard height so input is never covered
  React.useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Scroll to end when keyboard opens so latest messages stay visible
  React.useEffect(() => {
    if (keyboardHeight > 0) {
      const t = setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
      return () => clearTimeout(t);
    }
  }, [keyboardHeight]);

  // Reset mute state when session ends
  React.useEffect(() => {
    if (!isSessionActive) {
      setSpeakerMuted(false);
      setMicMuted(false);
    }
  }, [isSessionActive]);

  const handleStartSession = async () => {
    if (!sessionManager) return;
    await startSession();
    if (VOICE_VERIFICATION_ENABLED && inputMode === "audio" && voiceEnrolled === true) {
      await startVoiceCommand();
    }
  };

  const handleStopSession = () => {
    if (VOICE_VERIFICATION_ENABLED && voiceRecordingRef.current) {
      void stopVoiceCommand({ silentFailure: true });
    }
    stopSession();
  };

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text || !isSessionActive) return;
    setChatInput("");
    sendChatMessage(text);
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

  const handleCopyConversation = async () => {
    if (!messages.length) {
      setToast("No messages to copy", "info");
      return;
    }

    try {
      await Clipboard.setStringAsync(formatChatTranscript(messages, aiName, user?.username));
      setToast("Conversation copied", "success");
    } catch {
      setToast("Copy failed", "error");
    }
  };

  const voiceGateMessage =
    voiceGateStatus === "hearing"
      ? "I can hear audio..."
      : voiceGateStatus === "verifying"
        ? "Verifying your voice..."
        : voiceGateStatus === "verified"
          ? "Voice verified. Sending your command..."
          : isVoiceCommandRecording
            ? "Listening securely. Only verified commands are sent to the AI."
            : "Starting secure voice stream...";

  const voiceDebugText = voiceVerificationDebug
    ? formatVoiceVerificationDebug(voiceVerificationDebug)
    : null;
  const showInlineEndButton = keyboardHeight === 0;

  const chatContent = (
    <View
      className="flex-1"
      style={{
        zIndex: 10,
        paddingBottom:
          inputMode === "chat"
            ? keyboardHeight
            : VOICE_VERIFICATION_ENABLED && voiceEnrolled
              ? 130
              : 0,
      }}
    >
      {/* Audio / Chat mode switch + Speaker & Mic mute when session active */}
      <View className="flex-row items-center justify-center gap-1 mb-3 px-2 z-50">
        <TouchableOpacity
          onPress={() => setInputMode("audio")}
          activeOpacity={0.8}
          className={`flex-1 py-2.5 rounded-2xl flex-row items-center justify-center gap-2 ${inputMode === "audio"
            ? "bg-[#971BB2] dark:bg-[#B84DD4]"
            : "bg-white/80 dark:bg-accent/80"
            }`}
        >
          <Feather
            name="mic"
            size={18}
            color={inputMode === "audio" ? "#fff" : isDarkMode ? "#999" : "#555"}
          />
          <CText
            className={inputMode === "audio" ? "text-white" : "text-dark dark:text-gray-400"}
            style={{ fontFamily: "md" }}
          >
            Audio
          </CText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setInputMode("chat")}
          activeOpacity={0.8}
          className={`flex-1 py-2.5 rounded-2xl flex-row items-center justify-center gap-2 ${inputMode === "chat"
            ? "bg-[#971BB2] dark:bg-[#B84DD4]"
            : "bg-white/80 dark:bg-accent/80"
            }`}
        >
          <Feather
            name="message-circle"
            size={18}
            color={inputMode === "chat" ? "#fff" : isDarkMode ? "#999" : "#555"}
          />
          <CText
            className={inputMode === "chat" ? "text-white" : "text-dark dark:text-gray-400"}
            style={{ fontFamily: "md" }}
          >
            Chat
          </CText>
        </TouchableOpacity>
        {__DEV__ && (
          <TouchableOpacity
            onPress={handleCopyConversation}
            disabled={messages.length === 0}
            activeOpacity={0.8}
            className={`p-2.5 rounded-2xl bg-white/80 dark:bg-accent/80 ${messages.length === 0 ? "opacity-50" : ""}`}
          >
            <Feather
              name="copy"
              size={20}
              color={isDarkMode ? "#999" : "#555"}
            />
          </TouchableOpacity>
        )}
        {isSessionActive && inputMode !== "audio" && (
          <>
            <TouchableOpacity
              onPress={handleToggleSpeaker}
              activeOpacity={0.8}
              className={`p-2.5 rounded-2xl ${speakerMuted ? "bg-red-500/80 dark:bg-red-600/80" : "bg-white/80 dark:bg-accent/80"}`}
            >
              <Feather
                name={speakerMuted ? "volume-x" : "volume-2"}
                size={20}
                color={speakerMuted ? "#fff" : isDarkMode ? "#999" : "#555"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleToggleMic}
              activeOpacity={0.8}
              className={`p-2.5 rounded-2xl ${micMuted ? "bg-red-500/80 dark:bg-red-600/80" : "bg-white/80 dark:bg-accent/80"}`}
            >
              <Feather
                name={micMuted ? "mic-off" : "mic"}
                size={20}
                color={micMuted ? "#fff" : isDarkMode ? "#999" : "#555"}
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Messages: flex-1 so this area shrinks when keyboard opens */}
      <View className="flex-1 min-h-0 z-50">
        <ScrollView
          ref={scrollViewRef}
          className="py-2 flex-1 gap-y-4"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          showsVerticalScrollIndicator={messages.length > 0}
        >
          {messages.map((item: any, index: number) => {
            const isSystem = item.role === "system";
            const toolCall = item.role === "tool";

            return (
              <View key={index + item.id} className="mb-3 relative">
                {toolCall ? (
                  <ToolItem
                    item={item}
                    isSystem={isSystem}
                    aiName={aiName}
                  />
                ) : (
                  <ChatBox item={item} isSystem={isSystem} aiName={aiName} user={user} />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Chat mode: Start button when no session, input + Send + End when session active */}
      {inputMode === "chat" && (
        <View className="pt-2 pb-4 px-4">
          {isSessionActive ? (
            <View className="flex-row items-center gap-2 bg-white/90 dark:bg-accent/90 rounded-2xl px-3 py-2 min-h-[48]">
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Type a message..."
                placeholderTextColor={isDarkMode ? "#888" : "#666"}
                editable={true}
                multiline
                maxLength={2000}
                className="flex-1 text-dark dark:text-white text-base py-2 max-h-24"
                style={{ fontFamily: "md" }}
              />
              <TouchableOpacity
                onPress={handleSendChat}
                disabled={!chatInput.trim()}
                activeOpacity={0.7}
                className={`p-2 rounded-xl ${chatInput.trim()
                  ? "bg-[#971BB2] dark:bg-[#B84DD4]"
                  : "bg-gray-300 dark:bg-gray-600"
                  }`}
              >
                <Feather
                  name="send"
                  size={20}
                  color={chatInput.trim() ? "#fff" : "#888"}
                />
              </TouchableOpacity>
              {showInlineEndButton && (
                <TouchableOpacity
                  onPress={stopSession}
                  activeOpacity={0.7}
                  className="p-2 rounded-xl bg-red-500/90 dark:bg-red-600/90"
                >
                  <CText className="text-white text-sm" style={{ fontFamily: "md" }}>
                    End
                  </CText>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleStartSession}
              activeOpacity={0.8}
              className="w-full py-3.5 rounded-2xl bg-white dark:bg-accent2 border border-[#971BB2] dark:border-white/20 items-center justify-center shadow-sm"
            >
              <CText className="text-black dark:text-white text-base" style={{ fontFamily: "bold" }}>
                Start
              </CText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {__DEV__ && VOICE_VERIFICATION_ENABLED && inputMode === "audio" && (
        <View className="pt-2 pb-4 px-4">
          {voiceEnrolled === false && (
            <TouchableOpacity
              onPress={() => router.push("/voicereg")}
              activeOpacity={0.85}
              className="mb-3 rounded-2xl bg-amber-100 dark:bg-amber-900/40 px-4 py-3"
            >
              <CText className="text-amber-900 dark:text-amber-100 text-sm" style={{ fontFamily: "bold" }}>
                Enroll your voice to use verified commands
              </CText>
              <CText className="text-amber-800 dark:text-amber-200 text-xs mt-1">
                Tap here to record 3 samples. Unrecognized speakers are blocked before the AI runs tools.
              </CText>
            </TouchableOpacity>
          )}
          {voiceEnrolled === true && (
            isSessionActive ? (
              <View className="gap-y-3">
                <CText className="text-center text-xs text-gray-500 mt-2">
                  {voiceGateMessage}
                </CText>
                {__DEV__ && voiceDebugText ? (
                  <View className="rounded-xl bg-black/70 dark:bg-black/80 px-3 py-2">
                    <CText
                      className="text-[10px] text-emerald-200"
                      style={{ fontFamily: "md" }}
                    >
                      {voiceDebugText}
                    </CText>
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={handleStopSession}
                  activeOpacity={0.8}
                  className="w-full py-3.5 rounded-2xl bg-red-500/90 dark:bg-red-600/90 items-center justify-center shadow-sm"
                >
                  <CText className="text-white text-base" style={{ fontFamily: "bold" }}>
                    End
                  </CText>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-y-3">
                <CText className="text-center text-xs text-gray-500 mt-2">
                  Press Start to verify your voice and send commands to the AI.
                </CText>
                {__DEV__ && voiceDebugText ? (
                  <View className="rounded-xl bg-black/70 dark:bg-black/80 px-3 py-2">
                    <CText
                      className="text-[10px] text-emerald-200"
                      style={{ fontFamily: "md" }}
                    >
                      {voiceDebugText}
                    </CText>
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={handleStartSession}
                  activeOpacity={0.8}
                  className="w-full py-3.5 rounded-2xl bg-white dark:bg-accent2 border border-[#971BB2] dark:border-white/20 items-center justify-center shadow-sm"
                >
                  <CText className="text-black dark:text-white text-base" style={{ fontFamily: "bold" }}>
                    Start
                  </CText>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1 justify-start py-2 overflow-hidden rounded-3xl">
      {chatContent}

      {/* Decorative Lottie overlay behind content */}
      <View
        className="flex-1 h-full w-full absolute bottom-0"
        style={{ zIndex: 1 }}
        pointerEvents={inputMode === "chat" ? "none" : "auto"}
      >
        {Platform.OS === "ios" ? (
          <>
            <LottieView
              autoPlay={true}
              loop
              speed={10}
              ref={animation}
              style={{
                position: "absolute",
                bottom: -10,
                width: 1000,
                height: 500,
              }}
              resizeMode="cover"
              colorFilters={[
                { keypath: "Shape Layer 2", color: colors[currentMode].color1 },
                { keypath: "Shape Layer 1", color: colors[currentMode].color2 },
              ]}
              source={require("@/assets/anim/lower.json")}
            />
            <BlurView
              intensity={50}
              style={{
                flex: 1,
                justifyContent: "center",
                width: "100%",
                height: "100%",
              }}
            />
          </>
        ) : (
          <LottieView
            autoPlay={true}
            loop
            speed={10}
            ref={animation}
            style={{
              position: "absolute",
              bottom: -10,
              width: 1000,
              height: 500,
            }}
            resizeMode="cover"
            colorFilters={[
              { keypath: "Shape Layer 2", color: colors[currentMode].color1 },
              { keypath: "Shape Layer 1", color: colors[currentMode].color2 },
            ]}
            source={require("@/assets/anim/lower.json")}
          />
        )}
      </View>
    </View>
  );
}
