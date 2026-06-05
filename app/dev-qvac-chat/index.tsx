import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import ChatBox from "@/components/ChatItems/ChatBox";
import ToolItem from "@/components/ChatItems/ToolItem";
import { CText } from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import {
  qvacDevLab,
  type QvacDevChatMessage,
  type QvacDevChatRole,
} from "@/libs/dev/qvacDevLab";

type ChatRow = {
  id: string;
  role: QvacDevChatRole | "log";
  content: string;
};

const seedPrompt =
  "What's the weather in Tokyo and my horoscope for Aquarius?";

function labelForRole(role: ChatRow["role"]) {
  if (role === "user") return "You";
  if (role === "assistant") return "QVAC";
  if (role === "tool") return "Tool";
  if (role === "system") return "System";
  return "Log";
}

export default function DevQvacChatScreen() {
  const { aiName } = AppSettings();
  const { user } = UserItem();
  const [messages, setMessages] = useState<ChatRow[]>([
    {
      id: "system",
      role: "system",
      content:
        "Dev chat for QVAC streaming completion. Toggle tools to let the model call mock weather and horoscope functions.",
    },
  ]);
  const [input, setInput] = useState(seedPrompt);
  const [useTools, setUseTools] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const busyRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const appendLog = useCallback((content: string) => {
    if (content.startsWith("[toolCall]") || content.startsWith("[toolResult]")) {
      const isResult = content.startsWith("[toolResult]");
      const action = content
        .replace("[toolCall]", "")
        .replace("[toolResult]", "")
        .split(":")[0]
        .trim();
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-tool-${current.length}`,
          role: "tool",
          content,
          tool: {
            owner: "QVAC",
            action,
            status: isResult ? "complete" : "pending",
          },
        } as any,
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-log-${current.length}`, role: "log", content },
    ]);
  }, []);

  const appendAssistantDelta = useCallback((id: string, delta: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, content: `${message.content}${delta}` }
          : message
      )
    );
  }, []);

  const loadModel = useCallback(async () => {
    if (loadingModel || busyRef.current) return;
    setLoadingModel(true);
    try {
      await (useTools ? qvacDevLab.loadToolModel(appendLog) : qvacDevLab.loadLlm(appendLog));
      setSessionActive(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      appendLog(`Model load failed: ${message}`);
      Alert.alert("QVAC chat", message);
    } finally {
      setLoadingModel(false);
    }
  }, [appendLog, loadingModel, useTools]);

  const endSession = useCallback(async () => {
    if (busyRef.current) return;
    setLoadingModel(true);
    try {
      await qvacDevLab.unloadAll(appendLog);
      setSessionActive(false);
    } finally {
      setLoadingModel(false);
    }
  }, [appendLog]);

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || busyRef.current || !sessionActive) return;

    const userMessage: ChatRow = {
      id: `${Date.now()}-user`,
      role: "user",
      content: prompt,
    };
    const assistantId = `${Date.now()}-assistant`;
    const assistantMessage: ChatRow = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    busyRef.current = true;

    try {
      const history: QvacDevChatMessage[] = nextMessages
        .filter((message) => message.role !== "log" && message.id !== assistantId)
        .map((message) => ({
          role: message.role as QvacDevChatRole,
          content: message.content,
        }));

      await qvacDevLab.streamChat({
        history,
        useTools,
        onContentDelta: (text) => appendAssistantDelta(assistantId, text),
        onLog: appendLog,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      appendAssistantDelta(assistantId, `\n[error] ${message}`);
      Alert.alert("QVAC chat", message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [appendAssistantDelta, appendLog, input, messages, sessionActive, useTools]);

  useEffect(() => {
    return () => {
      void qvacDevLab.unloadAll(() => undefined);
    };
  }, []);

  if (!__DEV__) {
    return (
      <View className="flex-1 bg-grey dark:bg-dark justify-center items-center px-6">
        <CText className="text-center">
          This screen is only available in development builds.
        </CText>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 px-5 py-3 rounded-full bg-purple"
        >
          <CText className="text-white">Go back</CText>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-grey dark:bg-dark"
    >
      <View className="flex-1 px-4 pt-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-x-2 flex-1">
            <Pressable
              onPress={() => router.back()}
              className="p-3 rounded-full bg-white dark:bg-accent"
            >
              <IconLibrary.back />
            </Pressable>
            <View className="flex-1">
              <CText style={{ fontFamily: "bold" }} className="text-[1.2rem]">
                Dev — QVAC Chat
              </CText>
              <CText className="text-[0.8rem] opacity-60">
                Streaming completion {useTools ? "+ tools" : "only"}
              </CText>
            </View>
          </View>
          <Pressable
            onPress={() => setMessages([])}
            className="px-3 py-2 rounded-full bg-white dark:bg-accent"
          >
            <CText>Clear</CText>
          </Pressable>
        </View>

        <View className="p-4 rounded-2xl bg-white dark:bg-accent mb-3">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 pr-3">
              <CText style={{ fontFamily: "bold" }}>Tool calling</CText>
              <CText className="text-[0.8rem] opacity-70 mt-1">
                Enables mock get_weather and get_horoscope functions.
              </CText>
            </View>
            <Switch
              value={useTools}
              onValueChange={setUseTools}
              disabled={busy || sessionActive}
            />
          </View>
          <CText className="text-[0.8rem] opacity-60">
            {sessionActive
              ? "End the session to switch models."
              : useTools
                ? "Start will load Qwen3 600M with tool support."
                : "Start will load the Llama 3.2 completion model."}
          </CText>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <CText className="opacity-70 text-center py-8">
              Send a message to start a local QVAC chat.
            </CText>
          ) : (
            messages.map((message) => {
              const isLog = message.role === "log";
              const isTool = message.role === "tool";
              if (isTool) {
                return (
                  <ToolItem
                    key={message.id}
                    item={message}
                    isSystem={false}
                    aiName="QVAC"
                  />
                );
              }
              if (!isLog) {
                return (
                  <ChatBox
                    key={message.id}
                    item={{
                      ...message,
                      role: message.role === "assistant" ? "system" : message.role,
                    }}
                    isSystem={message.role !== "user"}
                    aiName={aiName || "QVAC"}
                    user={user}
                  />
                );
              }

              return (
                <View
                  key={message.id}
                  className="p-3 rounded-2xl bg-black/5 dark:bg-white/5"
                >
                  <CText style={{ fontFamily: "bold" }} className="text-[0.75rem] mb-1 opacity-60">
                    {labelForRole(message.role)}
                  </CText>
                  <CText selectable className="text-[0.78rem] opacity-75">
                    {message.content}
                  </CText>
                </View>
              );
            })
          )}
        </ScrollView>

        <View className="py-3 gap-y-2">
          {sessionActive ? (
            <View className="flex-row items-center gap-2 bg-white/90 dark:bg-accent/90 rounded-2xl px-3 py-2 min-h-[48]">
              <TextInput
                value={input}
                onChangeText={setInput}
                editable={!busy}
                multiline
                maxLength={2000}
                placeholder="Type a message..."
                placeholderTextColor="#8A8A8A"
                className="flex-1 text-black dark:text-white text-base py-2 max-h-24"
                style={{ fontFamily: "md" }}
              />
              <TouchableOpacity
                onPress={() => void send()}
                disabled={busy || !input.trim()}
                activeOpacity={0.7}
                className={`p-2 rounded-xl ${
                  busy || !input.trim()
                    ? "bg-gray-300 dark:bg-gray-600"
                    : "bg-[#971BB2] dark:bg-[#B84DD4]"
                }`}
              >
                <Feather
                  name="send"
                  size={20}
                  color={busy || !input.trim() ? "#888" : "#fff"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void endSession()}
                activeOpacity={0.7}
                className="p-2 rounded-xl bg-red-500/90 dark:bg-red-600/90"
              >
                <CText className="text-white text-sm" style={{ fontFamily: "md" }}>
                  End
                </CText>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-y-2">
              <TouchableOpacity
                onPress={() => void loadModel()}
                disabled={loadingModel}
                activeOpacity={0.8}
                className="w-full py-3.5 rounded-2xl bg-white dark:bg-accent2 border border-[#971BB2] dark:border-white/20 items-center justify-center shadow-sm"
              >
                <CText className="text-black dark:text-white text-base" style={{ fontFamily: "bold" }}>
                  {loadingModel ? "Starting..." : "Start"}
                </CText>
              </TouchableOpacity>
              <Pressable
                onPress={() => setInput(seedPrompt)}
                disabled={busy}
                className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
              >
                <CText className="text-center">Reset tool prompt</CText>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
