import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import CText from "@/components/TextComp";
import { useThemeContext } from "@/context/ThemeContext";
import UserItem from "@/utils/store/userstore.store";
import {
  getSupportConversation,
  getSupportMessages,
  sendSupportMessage,
  type SupportMessage,
} from "@/services/supportChatApi";

const POLL_MS = 8000;

function SupportMessageBubble({
  message,
  username,
}: {
  message: SupportMessage;
  username: string;
}) {
  const isUser = message.sender_type === "user";
  const senderLabel = isUser
    ? `@${username}`
    : message.admin?.name ?? "HeySolana Support";

  return (
    <View
      className={`mb-3 w-full ${isUser ? "items-end" : "items-start"}`}
    >
      <CText className="mb-1 px-1 text-[11px] text-black/50 dark:text-grey/60">
        {senderLabel}
      </CText>
      <View
        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
          isUser
            ? "rounded-tr-sm bg-purple"
            : "rounded-tl-sm bg-white dark:bg-accent"
        }`}
      >
        <CText
          className={`text-[14px] leading-5 ${
            isUser ? "text-white" : "text-black dark:text-white"
          }`}
        >
          {message.body}
        </CText>
      </View>
    </View>
  );
}

export default function SupportScreen() {
  const { isDarkMode } = useThemeContext();
  const { user } = UserItem();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const loadThread = useCallback(async (silent = false) => {
    if (!user) {
      setError("Sign in to chat with support.");
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setError(null);

    try {
      let convId = conversationId;
      if (!convId) {
        const conv = await getSupportConversation(user);
        if (!conv) {
          setError("Could not load support chat. Check your connection.");
          setLoading(false);
          return;
        }
        convId = conv.id;
        setConversationId(conv.id);
      }

      const data = await getSupportMessages(convId, user);
      if (!data) {
        if (!silent) setError("Could not load messages.");
        return;
      }
      setMessages(data.messages);
      setConversationId(data.conversation.id);
    } catch {
      if (!silent) setError("Something went wrong.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (conversationId) void loadThread(true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, loadThread]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || !user) return;

    setSending(true);
    setDraft("");
    const result = await sendSupportMessage(text, user, conversationId ?? undefined);
    setSending(false);

    if (!result) {
      setDraft(text);
      setError("Message failed to send. Try again.");
      return;
    }

    setConversationId(result.conversation.id);
    setMessages((prev) => [...prev, result.message]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView
      className="relative flex-1 bg-grey pt-3 dark:bg-dark"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View className="w-full flex-row items-center gap-x-4 px-4 pb-3">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? "#fff" : "#000"}
          />
        </Pressable>
        <View className="flex-1">
          <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">
            Support
          </CText>
          <CText className="text-[12px] text-black/50 dark:text-grey/60">
            Chat with the HeySolana team
          </CText>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#971BB2" />
        </View>
      ) : (
        <>
          {!!error && (
            <View className="mx-4 mb-2 rounded-xl bg-red-500/10 px-3 py-2">
              <CText className="text-[13px] text-red-600 dark:text-red-400">
                {error}
              </CText>
            </View>
          )}

          {messages.length === 0 && !error ? (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="chatbubbles-outline" size={48} color="#971BB2" />
              <CText
                style={{ fontFamily: "bold" }}
                className="mt-4 text-center text-[1rem]"
              >
                How can we help?
              </CText>
              <CText className="mt-2 text-center text-[13px] text-black/55 dark:text-grey/60">
                Send a message about transactions, airtime, data, or anything
                else. We typically reply within a few hours.
              </CText>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({ animated: false })
              }
              renderItem={({ item }) => (
                <SupportMessageBubble
                  message={item}
                  username={user?.username ?? "you"}
                />
              )}
            />
          )}

          <View className="border-t border-black/5 bg-white px-3 py-2 dark:border-white/10 dark:bg-black">
            <View className="flex-row items-end gap-x-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type your message…"
                placeholderTextColor={isDarkMode ? "#888" : "#999"}
                multiline
                maxLength={4000}
                className="max-h-28 flex-1 rounded-2xl bg-grey px-4 py-3 text-[15px] text-black dark:bg-accent dark:text-white"
                editable={!sending && !!user}
              />
              <Pressable
                onPress={() => void handleSend()}
                disabled={!draft.trim() || sending}
                className={`mb-1 h-11 w-11 items-center justify-center rounded-full ${
                  draft.trim() && !sending ? "bg-purple" : "bg-black/10 dark:bg-white/10"
                }`}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color={draft.trim() ? "#fff" : "#999"}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
