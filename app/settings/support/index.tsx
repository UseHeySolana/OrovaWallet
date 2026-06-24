import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CText from "@/components/TextComp";
import { useThemeContext } from "@/context/ThemeContext";
import UserItem from "@/utils/store/userstore.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { registerPushTokenWithBackend } from "@/services/push/pushNotifications";
import { consumePendingSupportConversationId } from "@/services/supportPushNavigation";
import {
  endSupportChat,
  getSupportHistory,
  getSupportMessages,
  resolveSupportAttachmentUrl,
  sendSupportMessage,
  type SupportConversation,
  type SupportImageAttachment,
  type SupportMessage,
} from "@/services/supportChatApi";

const POLL_MS = 8000;
const BRAND = "#971BB2";

const QUICK_TOPICS = [
  "How do I buy airtime or data?",
  "My transaction failed — what should I do?",
  "How do HeyPoints work?",
  "How do I swap tokens on HeySolana?",
];

function formatTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHistoryDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function pickSupportImage(): Promise<SupportImageAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName ?? `support-${Date.now()}.jpg`,
  };
}

function SupportAvatar({ size = 72 }: { size?: number }) {
  return (
    <View
      style={{
        width: size + 24,
        height: size + 24,
        borderRadius: (size + 24) / 2,
        backgroundColor: `${BRAND}22`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${BRAND}18`,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: `${BRAND}44`,
        }}
      >
        <Ionicons name="headset" size={size * 0.42} color={BRAND} />
      </View>
    </View>
  );
}

function SupportMessageBubble({ message }: { message: SupportMessage }) {
  const isUser = message.sender_type === "user";
  const hasImage = !!message.attachment_url;

  return (
    <View className={`mb-4 w-full ${isUser ? "items-end" : "items-start"}`}>
      <View
        className={`max-w-[82%] overflow-hidden rounded-2xl ${
          isUser ? "rounded-tr-md bg-[#E8E8EC] dark:bg-accent" : "rounded-tl-md"
        } ${hasImage || message.body ? "px-1 py-1" : ""}`}
        style={!isUser ? { backgroundColor: `${BRAND}22` } : undefined}
      >
        {hasImage && (
          <Image
            source={{ uri: resolveSupportAttachmentUrl(message.attachment_url)! }}
            style={{ width: 220, height: 220, borderRadius: 14 }}
            contentFit="cover"
          />
        )}
        {!!message.body && (
          <CText
            className={`px-3 py-2 text-[14px] leading-5 text-black dark:text-white ${
              hasImage ? "pt-1" : ""
            }`}
          >
            {message.body}
          </CText>
        )}
      </View>
      <CText className="mt-1 px-1 text-[11px] text-black/40 dark:text-grey/50">
        {formatTime(message.created_at)}
      </CText>
    </View>
  );
}

function PendingImagePreview({
  image,
  onRemove,
}: {
  image: SupportImageAttachment;
  onRemove: () => void;
}) {
  return (
    <View className="mb-2 flex-row items-center px-4">
      <View className="relative">
        <Image
          source={{ uri: image.uri }}
          style={{ width: 72, height: 72, borderRadius: 12 }}
          contentFit="cover"
        />
        <Pressable
          onPress={onRemove}
          className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-black"
        >
          <Ionicons name="close" size={14} color="#fff" />
        </Pressable>
      </View>
      <CText className="ml-3 flex-1 text-[12px] text-black/55 dark:text-grey/60">
        Image ready to send
      </CText>
    </View>
  );
}

function MessageInputBar({
  value,
  onChangeText,
  onSend,
  onPickImage,
  pendingImage,
  onRemoveImage,
  sending,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onPickImage: () => void;
  pendingImage: SupportImageAttachment | null;
  onRemoveImage: () => void;
  sending: boolean;
  placeholder: string;
}) {
  const { isDarkMode } = useThemeContext();
  const canSend = (value.trim().length > 0 || !!pendingImage) && !sending;

  return (
    <View className="border-t border-black/5 bg-white dark:border-white/10 dark:bg-black">
      {pendingImage && (
        <PendingImagePreview image={pendingImage} onRemove={onRemoveImage} />
      )}
      <View className="flex-row items-end gap-x-2 px-4 py-3">
        <Pressable
          onPress={onPickImage}
          disabled={sending}
          className="mb-1 h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: `${BRAND}18` }}
        >
          <Ionicons name="image-outline" size={22} color={BRAND} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? "#777" : "#999"}
          multiline
          maxLength={4000}
          className="max-h-28 min-h-[44px] flex-1 rounded-full bg-grey px-4 py-3 text-[15px] text-black dark:bg-accent dark:text-white"
          editable={!sending}
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canSend ? "#111" : isDarkMode ? "#333" : "#ddd",
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color={canSend ? "#fff" : "#999"} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function SupportScreen() {
  const { isDarkMode } = useThemeContext();
  const { user } = UserItem();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"landing" | "chat">("landing");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [history, setHistory] = useState<SupportConversation[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<SupportImageAttachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const displayName = user?.username ?? "there";
  const keyboardInset = Math.max(0, keyboardHeight - insets.bottom);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight <= 0 || mode !== "chat") return;
    const timer = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      100
    );
    return () => clearTimeout(timer);
  }, [keyboardHeight, mode]);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setError("Sign in to chat with support.");
      setLoading(false);
      return;
    }
    const items = await getSupportHistory(user);
    setHistory(items);
    setLoading(false);
  }, [user]);

  const loadThread = useCallback(
    async (convId: number, silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      const data = await getSupportMessages(convId, user);
      if (!data) {
        if (!silent) setError("Could not load messages.");
        setLoading(false);
        return;
      }
      setMessages(data.messages);
      setConversationId(data.conversation.id);
      setError(null);
      if (!silent) setLoading(false);
    },
    [user]
  );

  useEffect(() => {
    void loadHistory();
    if (user && AppSettings.getState().notifications) {
      void registerPushTokenWithBackend({ user });
    }
  }, [loadHistory, user]);

  useEffect(() => {
    const pendingId = consumePendingSupportConversationId();
    if (pendingId != null && user) {
      setMode("chat");
      setConversationId(pendingId);
      void loadThread(pendingId);
    }
  }, [user, loadThread]);

  useEffect(() => {
    if (mode !== "chat" || !conversationId) return;
    const timer = setInterval(() => {
      void loadThread(conversationId, true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [mode, conversationId, loadThread]);

  const openChat = async (convId: number) => {
    setMode("chat");
    setConversationId(convId);
    await loadThread(convId);
  };

  const handlePickImage = async () => {
    const image = await pickSupportImage();
    if (image) setPendingImage(image);
  };

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? draft).trim();
    const attachment = textOverride ? null : pendingImage;
    if ((!text && !attachment) || sending || !user) return;

    setSending(true);
    if (!textOverride) {
      setDraft("");
      setPendingImage(null);
    }
    setError(null);

    const result = await sendSupportMessage(
      text,
      user,
      conversationId ?? undefined,
      attachment
    );
    setSending(false);

    if (!result) {
      if (!textOverride) {
        setDraft(text);
        if (attachment) setPendingImage(attachment);
      }
      setError("Message failed to send. Try again.");
      return;
    }

    setConversationId(result.conversation.id);
    setMessages((prev) => [...prev, result.message]);
    setMode("chat");
    void loadHistory();
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleEndChat = async () => {
    setPendingImage(null);
    if (!conversationId || !user) {
      setMode("landing");
      setConversationId(null);
      setMessages([]);
      return;
    }
    await endSupportChat(conversationId, user);
    setMode("landing");
    setConversationId(null);
    setMessages([]);
    void loadHistory();
  };

  if (loading && mode === "landing" && history.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-grey dark:bg-dark">
        <ActivityIndicator color={BRAND} />
      </View>
    );
  }

  if (mode === "chat") {
    return (
      <View
        className="flex-1 bg-grey dark:bg-dark"
        style={{ paddingBottom: keyboardInset }}
      >
        <View className="flex-row items-center gap-x-3 border-b border-black/5 px-4 pb-3 pt-3 dark:border-white/10">
          <Pressable onPress={() => void handleEndChat()} className="p-1">
            <Ionicons
              name="arrow-back"
              size={22}
              color={isDarkMode ? "#fff" : "#000"}
            />
          </Pressable>
          <SupportAvatar size={36} />
          <View className="flex-1">
            <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
              Customer support
            </CText>
            <CText className="text-[11px] text-black/50 dark:text-grey/60">
              HeySolana team
            </CText>
          </View>
          <Pressable onPress={() => void handleEndChat()}>
            <CText
              style={{ fontFamily: "bold", color: BRAND }}
              className="text-[13px]"
            >
              End chat
            </CText>
          </Pressable>
        </View>

        {!!error && (
          <View className="mx-4 mt-2 rounded-xl bg-red-500/10 px-3 py-2">
            <CText className="text-[13px] text-red-600 dark:text-red-400">
              {error}
            </CText>
          </View>
        )}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={BRAND} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={({ item }) => <SupportMessageBubble message={item} />}
          />
        )}

        <MessageInputBar
          value={draft}
          onChangeText={setDraft}
          onSend={() => void handleSend()}
          onPickImage={() => void handlePickImage()}
          pendingImage={pendingImage}
          onRemoveImage={() => setPendingImage(null)}
          sending={sending}
          placeholder="Message…"
        />
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-grey dark:bg-dark"
      style={{ paddingBottom: keyboardInset }}
    >
      <View className="flex-row items-center gap-x-3 px-4 pb-2 pt-3">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDarkMode ? "#fff" : "#000"}
          />
        </Pressable>
        <CText style={{ fontFamily: "bold" }} className="text-[1.05rem]">
          Help &amp; Support
        </CText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View className="items-center px-6 pt-6">
          <SupportAvatar size={76} />
          <CText
            style={{ fontFamily: "bold" }}
            className="mt-5 text-center text-[1.35rem] leading-8"
          >
            Hey {displayName}.{"\n"}How can I help you?
          </CText>
        </View>

        {pendingImage && (
          <View className="mx-5 mt-4">
            <PendingImagePreview
              image={pendingImage}
              onRemove={() => setPendingImage(null)}
            />
          </View>
        )}

        <View className="mx-5 mt-6">
          <View
            className="flex-row items-center rounded-2xl bg-white px-3 py-1 shadow-sm dark:bg-accent"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Pressable
              onPress={() => void handlePickImage()}
              disabled={sending}
              className="p-2"
            >
              <Ionicons name="image-outline" size={22} color={BRAND} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write your message…"
              placeholderTextColor={isDarkMode ? "#777" : "#999"}
              multiline
              maxLength={4000}
              className="min-h-[48px] flex-1 py-3 text-[15px] text-black dark:text-white"
              editable={!sending && !!user}
            />
            <Pressable
              onPress={() => void handleSend()}
              disabled={(!draft.trim() && !pendingImage) || sending}
              className="p-2"
            >
              {sending ? (
                <ActivityIndicator size="small" color={BRAND} />
              ) : (
                <Ionicons
                  name="send"
                  size={22}
                  color={draft.trim() || pendingImage ? BRAND : "#ccc"}
                />
              )}
            </Pressable>
          </View>
        </View>

        <View className="mx-5 mt-5 gap-y-2">
          {QUICK_TOPICS.map((topic) => (
            <Pressable
              key={topic}
              onPress={() => setDraft(topic)}
              className="rounded-full border border-black/8 bg-white px-4 py-3 dark:border-white/10 dark:bg-accent"
            >
              <CText className="text-center text-[13px] text-black/75 dark:text-grey/80">
                {topic}
              </CText>
            </Pressable>
          ))}
        </View>

        {history.length > 0 && (
          <View className="mx-5 mt-8">
            <CText
              style={{ fontFamily: "bold" }}
              className="mb-3 text-[0.95rem] text-black/70 dark:text-grey/70"
            >
              Recent support
            </CText>
            {history.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void openChat(item.id)}
                className="mb-2 flex-row items-center rounded-2xl bg-white px-4 py-3 dark:bg-accent"
              >
                <View
                  className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${BRAND}18` }}
                >
                  <Ionicons
                    name={
                      item.last_message_preview === "Photo"
                        ? "image-outline"
                        : "chatbubble-ellipses-outline"
                    }
                    size={18}
                    color={BRAND}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <CText
                    numberOfLines={1}
                    className="text-[14px] text-black dark:text-white"
                  >
                    {item.last_message_preview || "Support conversation"}
                  </CText>
                  <CText className="mt-0.5 text-[11px] text-black/45 dark:text-grey/55">
                    {formatHistoryDate(item.last_message_at)}
                    {item.status !== "open" ? ` · ${item.status}` : ""}
                    {item.unread_user_count > 0
                      ? ` · ${item.unread_user_count} new`
                      : ""}
                  </CText>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isDarkMode ? "#666" : "#bbb"}
                />
              </Pressable>
            ))}
          </View>
        )}

        {!!error && (
          <View className="mx-5 mt-4 rounded-xl bg-red-500/10 px-3 py-2">
            <CText className="text-[13px] text-red-600 dark:text-red-400">
              {error}
            </CText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
