import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import CText from "@/components/TextComp";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import {
  startVerifiedVoiceRecording,
  stopVerifiedVoiceRecording,
} from "@/libs/voiceinfra/VerifiedVoiceRecorder";
import { enrollVoiceProfile, fetchVoiceStatus } from "@/services/voiceAuthApi";
import { useAi } from "@/context/AiContext";
import Buttons from "@/components/ButtonComp";
import AppSettings from "@/utils/store/settingsstore.store";

const enrollmentPrompts = [
  "My voice is my secure key, and I am enrolling it today to protect my wallet and confirm future actions.",
  "I am speaking clearly and naturally so Hey Solana can learn my voice pattern for secure verification.",
  "This voice profile belongs to me, and I will use it to safely approve wallet access and transactions.",
  "Hey Solana, please register my voice so I can verify my identity with confidence and security.",
  "I am creating a trusted voice profile that helps protect my account from unauthorized access.",
  "My spoken words confirm who I am, and this enrolment will help secure my Solana wallet.",
  "I am reading this phrase at a steady pace so my voice can be matched accurately later.",
  "This is my personal voice enrolment for Hey Solana, recorded clearly in a quiet environment.",
  "I authorize this voice sample to be used for secure identity verification inside my wallet.",
  "My voice should sound natural, calm, and consistent whenever I use Hey Solana for verification.",
];

const getRandomEnrollmentPrompt = (currentPrompt?: string) => {
  const availablePrompts = enrollmentPrompts.filter((prompt) => prompt !== currentPrompt);
  const prompts = availablePrompts.length > 0 ? availablePrompts : enrollmentPrompts;

  return prompts[Math.floor(Math.random() * prompts.length)];
};

export default function Voicereg() {
  const [recording, setRecording] = useState(false);
  const [savingSample, setSavingSample] = useState(false);
  const sampleDurationSeconds = 10;
  const [secondsLeft, setSecondsLeft] = useState(sampleDurationSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [samples, setSamples] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(() => getRandomEnrollmentPrompt());
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);
  const stoppingRef = useRef(false);
  const { user } = UserItem();
  const { publicKeyBase58, publicKey } = WalletItem();
  const { refreshVoiceEnrollment } = useAi();
  const { setToast } = AppSettings();

  const walletAddress = publicKeyBase58 ?? publicKey?.toBase58() ?? "";

  const clearRecordingTimers = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const finishRecording = useCallback(async () => {
    if (!recordingRef.current || stoppingRef.current) {
      return;
    }

    stoppingRef.current = true;
    try {
      clearRecordingTimers();
      setSavingSample(true);
      const audio = await stopVerifiedVoiceRecording();
      setSamples((current) => [...current, audio].slice(0, 3));
      setPrompt((currentPrompt) => getRandomEnrollmentPrompt(currentPrompt));
    } catch (error: any) {
      Alert.alert("Voice enrollment", error?.message ?? "Could not record voice sample");
    } finally {
      recordingRef.current = false;
      stoppingRef.current = false;
      setRecording(false);
      setSavingSample(false);
      setSecondsLeft(sampleDurationSeconds);
    }
  }, [clearRecordingTimers, sampleDurationSeconds]);

  const startSampleRecording = async () => {
    if (recording || savingSample || submitting || samples.length >= 3) {
      return;
    }

    try {
      setSecondsLeft(sampleDurationSeconds);
      await startVerifiedVoiceRecording();
      recordingRef.current = true;
      setRecording(true);

      countdownTimerRef.current = setInterval(() => {
        setSecondsLeft((current) => Math.max(0, current - 1));
      }, 1000);

      autoStopTimerRef.current = setTimeout(() => {
        void finishRecording();
      }, sampleDurationSeconds * 1000);
    } catch (error: any) {
      clearRecordingTimers();
      recordingRef.current = false;
      setRecording(false);
      setSecondsLeft(sampleDurationSeconds);
      Alert.alert("Voice enrollment", error?.message ?? "Could not record voice sample");
    }
  };

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      if (recordingRef.current) {
        void stopVerifiedVoiceRecording().catch(() => undefined);
      }
    };
  }, [clearRecordingTimers]);

  const submitEnrollment = async () => {
    if (!walletAddress) {
      setToast("Create or restore a wallet before enrolling your voice.", "error");
      return;
    }

    if (recording || savingSample) {
      setToast("Finish the current 10 second voice sample first.", "error");
      return;
    }

    if (samples.length < 3) {
      setToast("Record all 3 voice samples first.", "error");
      return;
    }

    try {
      setSubmitting(true);
      await enrollVoiceProfile({
        walletAddress,
        username: user?.username,
        samples,
      });
      const status = await fetchVoiceStatus(walletAddress);
      if (!status.enrolled) {
        throw new Error("Enrollment saved but profile is not active yet. Try again.");
      }
      await refreshVoiceEnrollment();

      Alert.alert("Voice enrolled", "Your voice is now required for voice commands.", [
        { text: "Done", onPress: () => router.replace("/dashboard") },
      ]);
    } catch (error: any) {
      const message = error?.message ?? "Please try again.";
      setToast(message, "error");
      if (message.toLowerCase().includes("similar")) {
        setSamples([]);
        setPrompt((currentPrompt) => getRandomEnrollmentPrompt(currentPrompt));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      className="flex-1 relative h-full bg-grey dark:bg-dark w-100 flex items-center justify-start"
    >
      <View className="w-100 m-auto flex justify-center items-start">
        <View className="w-11/12">
          <View className="">
            <CText style={{ fontFamily: "bold" }} className="text-[38px] text-wrap">&quot;{prompt}&quot;</CText>
          </View>
          <View>
            <CText className="text-[14px] text-gray-400">
              Record 3 voice samples, 10 seconds each. Speak naturally and vary your words so HeySolana gets a stronger voice dataset.
            </CText>
            <CText className="text-[18px] text-gray-400 mt-4">
              Sample {Math.min(samples.length + 1, 3)} of 3 · {samples.length} saved
            </CText>
            {recording ? (
              <CText className="text-[18px] text-gray-400 mt-2">
                Recording... {secondsLeft}s left. Keep speaking until it auto-saves.
              </CText>
            ) : null}
          </View>
        </View>

        <View className="w-11/12 m-auto mt-5 p-2 gap-y-3 ">

          <Buttons
            text={
              recording
                ? `Recording ${secondsLeft}s`
                : savingSample
                  ? "Saving sample..."
                  : samples.length >= 3
                    ? "All samples recorded"
                    : "Record 10s sample"
            }
            onPress={startSampleRecording}
            type={submitting || savingSample || recording || samples.length >= 3 ? "secondary" : "primary"}
          />
          <Buttons text={submitting ? "Saving voice..." : "Complete enrollment"} onPress={submitEnrollment} type={submitting || samples.length < 3 || recording || savingSample ? "secondary" : "primary"} />
        </View>

      </View>




    </View>
  );
}



