import React, { useRef, useState } from "react";
import { useThemeContext } from "@/context/ThemeContext";
import LottieView from "lottie-react-native";

import {
  Platform,
  ScrollView,
  TextInput,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
} from "react-native";
import ToolItem from "@/components/ChatItems/ToolItem";
import ChatBox from "@/components/ChatItems/ChatBox";
import AppSettings from "@/utils/store/settingsstore.store";
import { useAi } from "@/context/AiContext";
import { MessageType } from "@/utils/store/conversation.store";
import { BlurView } from "expo-blur";
import UserItem from "@/utils/store/userstore.store";
import CText from "@/components/TextComp";
import Feather from "@expo/vector-icons/Feather";

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

export default function ChatInterface({ messages }: ChatInterfaceProps) {
  const { isDarkMode } = useThemeContext();

  const { network, setLoading, aiName, refresher, pin, pinReminder } =
    AppSettings();
  const { user } = UserItem();
  const animation = useRef<LottieView>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  const {
    sessionManager,
    isSessionActive,
    startSession,
    stopSession,
    currentMode,
    conversationId,
    inputMode,
    setInputMode,
    sendChatMessage,
  } = useAi();

  const [chatInput, setChatInput] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // When session becomes active and we had a message waiting, send it
  React.useEffect(() => {
    if (isSessionActive && pendingMessage) {
      sendChatMessage(pendingMessage);
      setPendingMessage(null);
    }
  }, [isSessionActive, pendingMessage]);

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    if (isSessionActive) {
      sendChatMessage(text);
    } else {
      setPendingMessage(text);
      if (sessionManager) startSession();
    }
  };

  return (
    <View className="flex-1 justify-start py-2  overflow-hidden  rounded-3xl">
      {/* Audio / Chat mode switch */}
      <View className="flex-row items-center justify-center gap-1 mb-3 px-2">
        <TouchableOpacity
          onPress={() => setInputMode("audio")}
          activeOpacity={0.8}
          className={`flex-1 py-2.5 rounded-2xl flex-row items-center justify-center gap-2 ${
            inputMode === "audio"
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
          className={`flex-1 py-2.5 rounded-2xl flex-row items-center justify-center gap-2 ${
            inputMode === "chat"
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
      </View>

      {messages.length > 0 && (
        <View className="h-[44rem] z-50">
          <ScrollView
            ref={scrollViewRef}
            className=" py-2 relative h-[40rem] gap-y-4"
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {messages.map((item: any, index: number) => {
              const isSystem = item.role === "system";
              const toolCall = item.role === "tool";

              return (
                <View key={index + item.id} className="mb-3 relative">
                  {toolCall ? (
                    <>
                      <ToolItem
                        item={item}
                        isSystem={isSystem}
                        aiName={aiName}
                      />
                    </>
                  ) : (
                    <ChatBox item={item} isSystem={isSystem} aiName={aiName} user={user} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

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
                {
                  keypath: "Shape Layer 2",
                  color: colors[currentMode].color1,
                },
                {
                  keypath: "Shape Layer 1",
                  color: colors[currentMode].color2,
                },
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
            ></BlurView>
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
              {
                keypath: "Shape Layer 2",
                color: colors[currentMode].color1,
              },
              {
                keypath: "Shape Layer 1",
                color: colors[currentMode].color2,
              },
            ]}
            source={require("@/assets/anim/lower.json")}
          />
        )}
      </View>

      {/* Chat mode: always show input — type and press Send (starts session on first send) */}
      {inputMode === "chat" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="absolute bottom-4 left-4 right-4"
          style={{ zIndex: 999, elevation: 999 }}
        >
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
              className={`p-2 rounded-xl ${
                chatInput.trim()
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
            {isSessionActive && (
              <TouchableOpacity
                onPress={stopSession}
                activeOpacity={0.7}
                className="p-2 rounded-xl bg-gray-200 dark:bg-gray-600"
              >
                <Feather name="phone-off" size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
