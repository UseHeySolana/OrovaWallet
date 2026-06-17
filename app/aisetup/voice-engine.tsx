import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import Buttons from "@/components/ButtonComp";
import CText from "@/components/TextComp";
import VoiceEnginePicker from "@/components/AiSetup/VoiceEnginePicker";
import QvacHostModePicker from "@/components/AiSetup/QvacHostModePicker";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import type { QvacHostMode, VoiceBackend } from "@/libs/voiceinfra/types";
import {
  QVAC_MODEL_STORAGE_ESTIMATE_GB,
  voiceEngineOnboardingIntro,
} from "@/libs/voiceinfra/voiceBackendCopy";

export default function VoiceEngineOnboardingScreen() {
  const {
    voiceBackend,
    voiceEngineOnboarded,
    qvacHostMode,
    laptopHostAddress,
    setVoiceBackend,
    setQvacHostMode,
    setLaptopHostAddress,
    markVoiceEngineOnboarded,
    setToast,
  } = AppSettings();
  const [selected, setSelected] = useState<VoiceBackend>(voiceBackend ?? "openai");
  const [hostMode, setHostMode] = useState<QvacHostMode>(qvacHostMode ?? "laptop");
  const [hostAddress, setHostAddress] = useState(laptopHostAddress ?? "");
  const isReviewing = voiceEngineOnboarded;

  const handleContinue = () => {
    setVoiceBackend(selected);
    if (selected === "qvac") {
      setQvacHostMode(hostMode);
      setLaptopHostAddress(hostAddress);
    }
    if (!isReviewing) {
      markVoiceEngineOnboarded();
    }
    if (selected === "qvac") {
      setToast(
        hostMode === "laptop"
          ? "Private AI selected. Pair with HeySolana Voice Host on your computer when you start voice."
          : `Private AI selected. About ${QVAC_MODEL_STORAGE_ESTIMATE_GB} GB downloads on first voice session.`,
        "info"
      );
    } else {
      setToast("Public AI selected.", "info");
    }
    if (isReviewing) {
      router.back();
      return;
    }
    router.replace("/aisetup");
  };

  return (
    <View className="flex-1 bg-grey py-5 dark:bg-dark">
      <View className="w-full flex-row items-center gap-x-5 px-4">
        {isReviewing ? (
          <Pressable
            onPress={() => router.back()}
            className="rounded-full bg-white p-3 dark:bg-accent"
          >
            <IconLibrary.back />
          </Pressable>
        ) : (
          <View className="w-12" />
        )}
        <CText className="text-[1.4rem]">Voice engine</CText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-2 gap-y-2">
          <CText style={{ fontFamily: "bold" }} className="text-[1.35rem]">
            {voiceEngineOnboardingIntro.title}
          </CText>
          <CText className="text-[0.92rem] leading-5 text-black/65 dark:text-grey/75">
            {voiceEngineOnboardingIntro.subtitle}
          </CText>
        </View>

        <View className="flex-row gap-x-3 rounded-2xl border border-purple/20 bg-purple/5 p-4 dark:bg-purple/10">
          <Feather name="info" size={18} color="#971BB2" />
          <CText className="flex-1 text-[0.86rem] leading-5 text-black/70 dark:text-grey/80">
            {voiceEngineOnboardingIntro.storageNote}
          </CText>
        </View>

        <VoiceEnginePicker selected={selected} onSelect={setSelected} />

        {selected === "qvac" ? (
          <View className="gap-y-2">
            <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
              Where should models run?
            </CText>
            <QvacHostModePicker
              hostMode={hostMode}
              hostAddress={hostAddress}
              onHostModeChange={setHostMode}
              onHostAddressChange={setHostAddress}
            />
          </View>
        ) : null}

        <View className="rounded-2xl bg-white p-4 dark:bg-accent">
          <CText style={{ fontFamily: "bold" }} className="text-[0.95rem]">
            What stays the same
          </CText>
          <CText className="mt-2 text-[0.86rem] leading-5 text-black/65 dark:text-grey/75">
            Wallet keys never leave your device. Voice security enrollment is separate
            and optional — it verifies it is really you before sensitive commands run.
          </CText>
        </View>
      </ScrollView>

      <View className="w-11/12 gap-y-3 self-center p-2">
        <Buttons
          onPress={handleContinue}
          text={isReviewing ? "Save choice" : "Continue"}
          type="primary"
        />
      </View>
    </View>
  );
}
