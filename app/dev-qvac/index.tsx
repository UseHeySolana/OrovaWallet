import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import { qvacDevLab } from "@/libs/dev/qvacDevLab";

function formatStatus() {
  const s = qvacDevLab.getStatus();
  return [
    `Provider: ${s.started ? "running" : "stopped"}`,
    `LLM: ${s.llmModelId ?? "not loaded"}`,
    `Tool model: ${s.toolModelId ?? "not loaded"}`,
    `Embedding: ${s.embedModelId ?? "not loaded"}`,
  ].join("\n");
}

export default function DevQvacScreen() {
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState(formatStatus());
  const busyRef = useRef(false);

  const refreshStatus = useCallback(() => {
    setStatus(formatStatus());
  }, []);

  const log = useCallback((line: string) => {
    setLogs((current) =>
      [`${new Date().toLocaleTimeString()} ${line}`, ...current].slice(0, 200)
    );
  }, []);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        log(`>> ${label}`);
        await fn();
        log(`<< ${label} done`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log(`!! ${label} failed: ${message}`);
        Alert.alert("QVAC dev", message);
      } finally {
        busyRef.current = false;
        setBusy(false);
        refreshStatus();
      }
    },
    [log, refreshStatus]
  );

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

  const btn = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      disabled={busy}
      onPress={onPress}
      className={`py-3 px-4 rounded-xl ${
        busy
          ? "bg-grey opacity-60"
          : primary
            ? "bg-purple"
            : "bg-white dark:bg-accent border border-grey/15"
      }`}
    >
      <CText className={`text-center ${primary ? "text-white" : ""}`}>{label}</CText>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-grey dark:bg-dark px-4 pt-3">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-x-2 flex-1">
          <Pressable
            onPress={() => router.back()}
            className="p-3 rounded-full bg-white dark:bg-accent"
          >
            <IconLibrary.back />
          </Pressable>
          <CText style={{ fontFamily: "bold" }} className="text-[1.2rem]">
            Dev — QVAC Lab
          </CText>
        </View>
        {logs.length > 0 && (
          <Pressable
            onPress={() => setLogs([])}
            className="px-3 py-2 rounded-full bg-white dark:bg-accent"
          >
            <CText>Clear log</CText>
          </Pressable>
        )}
      </View>

      <CText className="text-[0.85rem] opacity-70 mb-3">
        Exercises on-device QVAC from docs/qvac.md: streaming completion, tool
        calls, KV cache, and embeddings. First model download can take a while on
        device.
      </CText>

      <View className="p-4 rounded-2xl bg-white dark:bg-accent mb-3">
        <CText style={{ fontFamily: "bold" }} className="text-[1rem] mb-2">
          Status
        </CText>
        <CText
          className="text-[0.8rem] opacity-80 mb-3"
          style={{ fontFamily: "monospace" }}
          selectable
        >
          {status}
        </CText>
        <View className="gap-y-2">
          {btn(
            "Load LLM (Llama 3.2 1B)",
            () =>
              void run("Load LLM", async () => {
                await qvacDevLab.loadLlm(log);
              }),
            true
          )}
          {btn("Load tool model (Qwen3 600M)", () =>
            void run("Load tool model", async () => {
              await qvacDevLab.loadToolModel(log);
            })
          )}
          {btn("Load embedding model", () =>
            void run("Load embedding", async () => {
              await qvacDevLab.loadEmbed(log);
            })
          )}
        </View>
      </View>

      <View className="p-4 rounded-2xl bg-white dark:bg-accent mb-3">
        <CText style={{ fontFamily: "bold" }} className="text-[1rem] mb-2">
          Tests
        </CText>
        <View className="gap-y-2">
          {btn(
            "1. Streaming completion",
            () =>
              void run("Streaming completion", async () => {
                await qvacDevLab.runStreamingCompletion(log);
              }),
            true
          )}
          {btn("2. Tool call + follow-up", () =>
            void run("Tool call", async () => {
              await qvacDevLab.runToolCall(log);
            })
          )}
          {btn("3. KV cache comparison", () =>
            void run("KV cache", async () => {
              await qvacDevLab.runKvCache(log);
            })
          )}
          {btn("4. Embedding", () =>
            void run("Embedding", async () => {
              await qvacDevLab.runEmbed(log);
            })
          )}
          {btn("Clear KV caches", () =>
            void run("Clear KV cache", async () => {
              await qvacDevLab.clearKvCache(log);
            })
          )}
          {btn("Unload all models", () =>
            void run("Unload all", async () => {
              await qvacDevLab.unloadAll(log);
            })
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {logs.length === 0 ? (
          <CText className="opacity-70 text-center py-8">
            Load a model and run a test. Output appears here.
          </CText>
        ) : (
          logs.map((line, index) => (
            <CText
              key={`${index}-${line.slice(0, 24)}`}
              selectable
              className="text-[0.78rem] mb-2 opacity-90"
              style={{ fontFamily: "monospace" }}
            >
              {line}
            </CText>
          ))
        )}
      </ScrollView>
    </View>
  );
}
