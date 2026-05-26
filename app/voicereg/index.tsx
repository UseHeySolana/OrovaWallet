import React, { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
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

/**
  * What should be done here
  * 1. Register User Voice for Authentication 
  * 2. Save User Voice and ask if to create wallet with their voice
  * 
*/

export default function Voicereg() {
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [samples, setSamples] = useState<string[]>([]);
  const { user } = UserItem();
  const { publicKeyBase58, publicKey } = WalletItem();
  const { refreshVoiceEnrollment } = useAi();

  const walletAddress = publicKeyBase58 ?? publicKey?.toBase58() ?? "";
  const prompt = useMemo(() => {
    const prompts = [
      "Hey Solana, this is my wallet.",
      "Confirm my voice for secure commands.",
      "Only my voice can approve wallet actions.",
    ];

    return prompts[Math.min(samples.length, prompts.length - 1)];
  }, [samples.length]);

  const toggleRecording = async () => {
    try {
      if (recording) {
        const audio = await stopVerifiedVoiceRecording();
        setSamples((current) => [...current, audio].slice(0, 3));
        setRecording(false);
        return;
      }

      await startVerifiedVoiceRecording();
      setRecording(true);
    } catch (error: any) {
      setRecording(false);
      Alert.alert("Voice enrollment", error?.message ?? "Could not record voice sample");
    }
  };

  const submitEnrollment = async () => {
    if (!walletAddress) {
      Alert.alert("Voice enrollment", "Create or restore a wallet before enrolling your voice.");
      return;
    }

    if (samples.length < 3) {
      Alert.alert("Voice enrollment", "Record all 3 voice samples first.");
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
      Alert.alert("Voice enrollment failed", error?.message ?? "Please try again.");
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
            <CText style={{ fontFamily: "bold" }} className="text-[48px] text-wrap">&quot;{prompt}&quot;</CText>
          </View>
          <View>
            <CText className="text-[24px] text-gray-400">
              Record 3 short samples. Use your normal command voice so HeySolana can reject other speakers.
            </CText>
            <CText className="text-[18px] text-gray-400 mt-4">
              Sample {Math.min(samples.length + 1, 3)} of 3
            </CText>
          </View>
        </View>

        <View className="w-11/12 m-auto mt-5 p-2 gap-y-3 ">

          <Buttons text={recording ? "Stop sample" : "Record sample"} onPress={toggleRecording} type={submitting || (samples.length >= 3 && !recording) ? "secondary" : "primary"} />
          <Buttons text={submitting ? "Saving voice..." : "Complete enrollment"} onPress={submitEnrollment} type={submitting || samples.length < 3 ? "secondary" : "primary"} />
        </View>

      </View>




    </View>
  );
}



