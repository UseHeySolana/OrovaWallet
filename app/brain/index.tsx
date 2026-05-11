import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import BrainStore from "@/utils/store/brain.store";
import { useThemeContext } from "@/context/ThemeContext";
import { confirm } from "@/services/confirmation";
import { useAi } from "@/context/AiContext";

export default function BrainHome() {
  const { isDarkMode } = useThemeContext();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { suggestions, dismissSuggestion, clearSuggestions } = BrainStore();
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

      {ordered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <CText>No suggestions yet.</CText>
          <CText className="opacity-70 text-center mt-2">
            Use the app and the brain will surface reminders, trade ideas, and price alerts.
          </CText>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          <View className="gap-y-3 pb-8">
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
        </ScrollView>
      )}
    </View>
  );
}

