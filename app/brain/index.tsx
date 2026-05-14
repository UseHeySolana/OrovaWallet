import { useMemo } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import BrainStore from "@/utils/store/brain.store";
import { confirm } from "@/services/confirmation";
import { useAi } from "@/context/AiContext";
import {
  addDevSolPriceAlert,
  clearDevPriceAlerts,
  runDevBrainDigestNow,
  seedDevBrainJournalSample,
} from "@/libs/brain";

export default function BrainHome() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { suggestions, dismissSuggestion, clearSuggestions, priceAlerts } = BrainStore();
  const { isSessionActive, startSession, setInputMode, sendChatMessage } = useAi();

  const ordered = useMemo(() => {
    const list = [...suggestions].sort((a, b) => b.createdAt - a.createdAt);
    if (!focus) return list;
    const idx = list.findIndex((s) => s.id === focus);
    if (idx <= 0) return list;
    const [item] = list.splice(idx, 1);
    return [item, ...list];
  }, [suggestions, focus]);

  const openSuggestion = async (s: any) => {
    // Trade suggestions must be explicitly approved before initiating any action.
    if (s?.type === "trade") {
      const draft = s?.data?.swapDraft;
      const summary =
        draft && typeof draft === "object"
          ? `${draft.amount} ${draft.fromToken} → ${draft.toToken}`
          : undefined;

      const approved = await confirm({
        message: "Approve this trade?",
        subtitle: summary ? `Proposed swap: ${summary}` : "This will prepare a swap in the assistant.",
        type: "fingerprint",
      });

      if (!approved) return;

      // Route to dashboard so the user sees the assistant context.
      router.push("/dashboard");

      // Ensure we are in chat mode (no mic required for approvals).
      setInputMode("chat");
      if (!isSessionActive) {
        await startSession();
      }

      // Ask the assistant to execute the trade using existing tool flow (which also prompts before signing).
      if (draft && typeof draft === "object") {
        sendChatMessage(
          `Swap ${draft.amount} ${draft.fromToken} to ${draft.toToken}. Show me the quote and execute after confirmation.`
        );
      } else {
        sendChatMessage("I approved the trade. Please show the quote and execute after confirmation.");
      }

      return;
    }

    if (s?.link && typeof s.link === "string") {
      router.push(s.link as any);
      return;
    }

    // Fallback routing based on suggestion type.
    if (s?.type === "price_alert") {
      router.push("/settings");
      return;
    }
  };

  return (
    <View className="flex-1 bg-grey dark:bg-dark px-4 pt-3">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-x-2">
          <Pressable
            onPress={() => router.back()}
            className="p-3 rounded-full bg-white dark:bg-accent"
          >
            <IconLibrary.back />
          </Pressable>
          <CText style={{ fontFamily: "bold" }} className="text-[1.25rem]">
            Brain
          </CText>
        </View>

        {ordered.length > 0 && (
          <Pressable
            onPress={() => clearSuggestions()}
            className="px-3 py-2 rounded-full bg-white dark:bg-accent"
          >
            <CText className="text-[1rem]">Clear</CText>
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {ordered.length === 0 ? (
          <View className="py-12 items-center justify-center px-2">
            <CText>No suggestions yet.</CText>
            <CText className="opacity-70 text-center mt-2">
              Use the app and the brain will surface reminders, trade ideas, and price alerts.
            </CText>
          </View>
        ) : (
          <View className="gap-y-3">
            {ordered.map((s) => (
              <View
                key={s.id}
                className={`p-4 rounded-2xl bg-white dark:bg-accent border ${
                  focus === s.id ? "border-purple" : "border-grey/10"
                }`}
              >
                <View className="flex-row items-start justify-between gap-x-3">
                  <View className="flex-1">
                    <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">
                      {s.title}
                    </CText>
                    <CText className="text-[1rem] opacity-80 mt-1">{s.body}</CText>
                    <CText className="text-[0.9rem] opacity-60 mt-2">
                      {new Date(s.createdAt).toLocaleString()}
                    </CText>
                  </View>

                  <Pressable
                    onPress={() => dismissSuggestion(s.id)}
                    className="p-2 rounded-full bg-grey dark:bg-accent2"
                  >
                    <IconLibrary.delete />
                  </Pressable>
                </View>

                <View className="flex-row items-center justify-end gap-x-2 mt-3">
                  <Pressable
                    onPress={() => openSuggestion(s)}
                    className="px-4 py-3 rounded-full bg-purple"
                  >
                    <CText className="text-white">Open</CText>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {__DEV__ ? (
          <View className="mt-8 pt-6 border-t border-grey/20 dark:border-white/10">
            <CText style={{ fontFamily: "bold" }} className="text-[1rem] mb-1">
              Developer — Brain
            </CText>
            <CText className="text-[0.85rem] opacity-70 mb-4">
              Price alerts: keep app in foreground, enable notifications in Settings, then add the
              test SOL alert. Digest: seeds sample chat/tool events then builds suggestion cards. Set
              EXPO_PUBLIC_BRAIN_SUGGESTIONS_LLM=true (and your OpenAI-compatible URL) for model-written
              cards with contextual rules as fallback.
            </CText>
            <CText className="text-[0.8rem] opacity-60 mb-3">
              Active price alerts: {priceAlerts.length}
            </CText>

            <View className="gap-y-2">
              <Pressable
                onPress={() => {
                  seedDevBrainJournalSample();
                  void runDevBrainDigestNow().then(() =>
                    Alert.alert("Brain", "Sample events added and digest ran. Scroll up for a new card.")
                  );
                }}
                className="py-3 px-4 rounded-xl bg-purple"
              >
                <CText className="text-white text-center">Seed sample journal + run digest</CText>
              </Pressable>

              <Pressable
                onPress={() => {
                  void runDevBrainDigestNow().then(() =>
                    Alert.alert("Brain", "Digest ran from your current journal (if any events).")
                  );
                }}
                className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
              >
                <CText className="text-center">Run digest only (no seed)</CText>
              </Pressable>

              <Pressable
                onPress={() => {
                  addDevSolPriceAlert();
                  Alert.alert(
                    "Brain",
                    "Test SOL alert added. With notifications on and app active, you should get a local alert within ~1 minute (poll interval)."
                  );
                }}
                className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
              >
                <CText className="text-center">Add test SOL price alert</CText>
              </Pressable>

              <Pressable
                onPress={() => {
                  clearDevPriceAlerts();
                  Alert.alert("Brain", "Removed dev test price alerts.");
                }}
                className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
              >
                <CText className="text-center">Clear dev price alerts</CText>
              </Pressable>

              <Pressable
                onPress={() => router.push("/dev-network")}
                className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
              >
                <CText className="text-center">Open network request log</CText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

