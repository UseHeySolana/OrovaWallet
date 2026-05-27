import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import {
  fetchVoiceStatus,
  verifyVoiceCommand,
  type VoiceStatusResponse,
  type VoiceVerifyResponse,
} from "@/services/voiceAuthApi";
import {
  startVerifiedVoiceRecording,
  stopVerifiedVoiceRecording,
} from "@/libs/voiceinfra/VerifiedVoiceRecorder";
import { VerifiedVoiceStream } from "@/libs/voiceinfra/VerifiedVoiceStream";

type StreamState = "idle" | "listening" | "hearing" | "verifying" | "verified";

function formatStatus(status: VoiceStatusResponse | null) {
  if (!status) return "Not loaded";

  return [
    `Enrolled: ${status.enrolled ? "yes" : "no"}`,
    `Samples: ${status.sample_count ?? "unknown"}`,
    `Algorithm: ${status.algorithm_version ?? "unknown"}`,
    `Threshold: ${status.threshold ?? "unknown"}`,
    `Adapt min: ${status.adapt_min_confidence ?? "unknown"}`,
    `Voice AI: ${status.voice_ai_enabled ? status.voice_ai_url ?? "enabled" : "disabled"}`,
    `Last verified: ${status.last_verified_at ?? "never"}`,
  ].join("\n");
}

function formatVerifyResult(result: VoiceVerifyResponse | null) {
  if (!result) return "No verification run yet";

  return [
    `Verified: ${result.verified ? "yes" : "no"}`,
    `Enrolled: ${result.enrolled ? "yes" : "no"}`,
    `Confidence: ${result.confidence}`,
    `Threshold: ${result.threshold ?? "not returned"}`,
    `Stored threshold: ${result.stored_threshold ?? "not returned"}`,
    `Scores: ${result.scores?.join(", ") || "not returned"}`,
    `Duration: ${result.duration_seconds ?? "not returned"}s`,
    `Algorithm: ${result.algorithm_version ?? "unknown"}`,
    `Adapted: ${result.adapted ? "yes" : "no"}`,
    `Transcript: ${result.transcript || "none"}`,
    result.message ? `Message: ${result.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function DevVoiceScreen() {
  const { user } = UserItem();
  const { publicKey, publicKeyBase58 } = WalletItem();
  const walletAddress = publicKeyBase58 ?? publicKey?.toBase58() ?? "";

  const [status, setStatus] = useState<VoiceStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [adapt, setAdapt] = useState(false);
  const [lastAudio, setLastAudio] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VoiceVerifyResponse | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [streamHits, setStreamHits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<VerifiedVoiceStream | null>(null);
  const recordingRef = useRef(false);

  const walletLabel = useMemo(() => {
    if (!walletAddress) return "No wallet loaded";
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`;
  }, [walletAddress]);

  const loadStatus = useCallback(async () => {
    if (!walletAddress) {
      Alert.alert("Dev voice", "Create or restore a wallet before testing voice verification.");
      return;
    }

    try {
      setError(null);
      setStatusLoading(true);
      setStatus(await fetchVoiceStatus(walletAddress));
    } catch (err: any) {
      setError(err?.message ?? "Could not load voice status");
    } finally {
      setStatusLoading(false);
    }
  }, [walletAddress]);

  const stopStream = useCallback(async () => {
    const stream = streamRef.current;
    streamRef.current = null;
    setStreaming(false);
    setStreamState("idle");
    if (stream) {
      await stream.stop();
    }
  }, []);

  const runVerify = useCallback(async (audio: string) => {
    if (!walletAddress) {
      Alert.alert("Dev voice", "Create or restore a wallet before testing voice verification.");
      return;
    }

    try {
      setError(null);
      setVerifying(true);
      const result = await verifyVoiceCommand({
        walletAddress,
        audio,
        adapt,
      });
      setVerifyResult(result);
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? "Voice verification failed");
    } finally {
      setVerifying(false);
    }
  }, [adapt, loadStatus, walletAddress]);

  const toggleRecording = async () => {
    try {
      setError(null);
      if (recording) {
        const audio = await stopVerifiedVoiceRecording();
        setRecording(false);
        setLastAudio(audio);
        await runVerify(audio);
        return;
      }

      if (streaming) {
        await stopStream();
      }
      await startVerifiedVoiceRecording();
      setRecording(true);
    } catch (err: any) {
      setRecording(false);
      setError(err?.message ?? "Could not record voice");
    }
  };

  const verifyLastAudio = async () => {
    if (!lastAudio) {
      Alert.alert("Dev voice", "Record a sample first.");
      return;
    }
    await runVerify(lastAudio);
  };

  const toggleStream = async () => {
    try {
      setError(null);
      if (streaming) {
        await stopStream();
        return;
      }

      if (!walletAddress) {
        Alert.alert("Dev voice", "Create or restore a wallet before testing voice verification.");
        return;
      }

      if (recording) {
        await stopVerifiedVoiceRecording().catch(() => undefined);
        setRecording(false);
      }

      const stream = new VerifiedVoiceStream({
        walletAddress,
        onStateChange: (state) => setStreamState(state),
        onVerifiedCommand: (transcript, audio) => {
          setLastAudio(audio);
          setStreamHits((current) =>
            [
              `${new Date().toLocaleTimeString()} verified: "${transcript || "[no transcript]"}"`,
              ...current,
            ].slice(0, 5)
          );
        },
        onError: (err) => setError(err.message),
      });
      streamRef.current = stream;
      await stream.start();
      setStreaming(true);
      setStreamState("listening");
    } catch (err: any) {
      await stopStream().catch(() => undefined);
      setError(err?.message ?? "Could not start verified voice stream");
    }
  };

  useEffect(() => {
    if (__DEV__ && walletAddress) {
      void loadStatus();
    }
  }, [loadStatus, walletAddress]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    return () => {
      void stopStream();
      if (recordingRef.current) {
        void stopVerifiedVoiceRecording().catch(() => undefined);
      }
    };
  }, [stopStream]);

  if (!__DEV__) {
    return (
      <View className="flex-1 bg-grey dark:bg-dark justify-center items-center px-6">
        <CText className="text-center">This screen is only available in development builds.</CText>
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
    <View className="flex-1 bg-grey dark:bg-dark px-4 pt-3">
      <View className="flex-row items-center gap-x-2 mb-4">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <View className="flex-1">
          <CText style={{ fontFamily: "bold" }} className="text-[1.2rem]">
            Dev Voice Verification
          </CText>
          <CText className="text-[0.85rem] opacity-60">{walletLabel}</CText>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4 rounded-2xl bg-white dark:bg-accent">
          <CText style={{ fontFamily: "bold" }} className="text-[1rem] mb-2">
            Voice profile
          </CText>
          <CText className="text-[0.85rem] opacity-70 mb-3">
            User: {user?.username ?? "unknown"}
          </CText>
          <CText className="text-[0.8rem] mb-3" style={{ fontFamily: "monospace" }} selectable>
            {formatStatus(status)}
          </CText>
          <Pressable
            onPress={() => void loadStatus()}
            disabled={statusLoading}
            className={`py-3 px-4 rounded-xl ${statusLoading ? "bg-grey" : "bg-purple"}`}
          >
            <CText className="text-white text-center">
              {statusLoading ? "Loading status..." : "Refresh status"}
            </CText>
          </Pressable>
        </View>

        <View className="p-4 rounded-2xl bg-white dark:bg-accent">
          <CText style={{ fontFamily: "bold" }} className="text-[1rem] mb-2">
            One-shot verify
          </CText>
          <CText className="text-[0.85rem] opacity-70 mb-3">
            Record a short command sample and submit it to /v2/voice/verify.
          </CText>
          <View className="flex-row items-center justify-between mb-3">
            <CText>Adapt profile on success</CText>
            <Switch value={adapt} onValueChange={setAdapt} />
          </View>
          <View className="gap-y-2">
            <Pressable
              onPress={() => void toggleRecording()}
              disabled={verifying}
              className={`py-3 px-4 rounded-xl ${recording ? "bg-red-500" : "bg-purple"}`}
            >
              <CText className="text-white text-center">
                {recording ? "Stop and verify sample" : "Record sample"}
              </CText>
            </Pressable>
            <Pressable
              onPress={() => void verifyLastAudio()}
              disabled={!lastAudio || verifying || recording}
              className={`py-3 px-4 rounded-xl border border-grey/15 ${!lastAudio || verifying || recording
                ? "bg-grey"
                : "bg-white dark:bg-accent"
                }`}
            >
              <CText className="text-center">
                {verifying ? "Verifying..." : "Verify last audio again"}
              </CText>
            </Pressable>
          </View>
          <CText className="text-[0.8rem] mt-3" style={{ fontFamily: "monospace" }} selectable>
            {formatVerifyResult(verifyResult)}
          </CText>
        </View>

        <View className="p-4 rounded-2xl bg-white dark:bg-accent">
          <CText style={{ fontFamily: "bold" }} className="text-[1rem] mb-2">
            Live stream verify
          </CText>
          <CText className="text-[0.85rem] opacity-70 mb-3">
            Uses the same VerifiedVoiceStream path as live commands. Speak normally and watch for a verified callback.
          </CText>
          <CText className="text-[0.85rem] mb-3">State: {streamState}</CText>
          <Pressable
            onPress={() => void toggleStream()}
            className={`py-3 px-4 rounded-xl ${streaming ? "bg-red-500" : "bg-purple"}`}
          >
            <CText className="text-white text-center">
              {streaming ? "Stop live stream" : "Start live stream"}
            </CText>
          </Pressable>
          <View className="mt-3 gap-y-1">
            {streamHits.length === 0 ? (
              <CText className="text-[0.8rem] opacity-60">No verified stream callbacks yet.</CText>
            ) : (
              streamHits.map((hit) => (
                <CText key={hit} className="text-[0.8rem]">
                  {hit}
                </CText>
              ))
            )}
          </View>
        </View>

        {error ? (
          <View className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
            <CText style={{ fontFamily: "bold" }} className="text-red-500 mb-1">
              Last error
            </CText>
            <CText className="text-red-500" selectable>
              {error}
            </CText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
