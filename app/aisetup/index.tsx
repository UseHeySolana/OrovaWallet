import { Pressable, ScrollView, View } from "react-native";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import { useEffect, useState } from "react";
import AppSettings from "@/utils/store/settingsstore.store";
import { router } from "expo-router";
import { Switch } from "react-native";
import { TextInput } from "react-native";
import IconLibrary from "@/utils/icons";
import type { VoiceBackend } from "@/libs/voiceinfra/types";
import VoiceEnginePicker from "@/components/AiSetup/VoiceEnginePicker";
import {
  labelForVoiceBackend,
  QVAC_MODEL_STORAGE_ESTIMATE_GB,
} from "@/libs/voiceinfra/voiceBackendCopy";

const Items = [
  {
    id: 1,
    title: "Voice Assistant",
    description: "",
    subItems: [],
    type: "toogle",
  },
  {
    id: 2,
    title: "Assistant Language",
    description: "",
    subItems: [
      { id: 1, title: "English", description: "" },
      { id: 2, title: "Yoruba", description: "" },
      { id: 3, title: "Igbo", description: "" },
      { id: 4, title: "Hausa", description: "" },
    ],
    type: "dropdown",
  },
  {
    id: 3,
    title: "Voice engine",
    description: "",
    subItems: [],
    type: "voiceBackend",
  },
  {
    id: 4,
    title: "Assistant Name",
    description: "",
    subItems: [{ id: 1, title: "User Input", description: "" }],
    type: "input",
  },
];

export default function SetUpAi() {
  const {
    skippedAiSettings,
    aiName,
    aiLanguage,
    voiceBackend,
    voiceEngineOnboarded,
    setToast,
  } = AppSettings();
  const [toggleDropdown, setToggleDropdown] = useState(false);
  const [settings, setSettings] = useState({
    aiActive: true,
    language: aiLanguage,
    assistantName: aiName,
    voiceBackend: voiceBackend,
  });

  useEffect(() => {
    if (!voiceEngineOnboarded) {
      router.replace("/aisetup/voice-engine");
      return;
    }
    if (skippedAiSettings) {
      router.replace("/voicereg");
    }
  }, [skippedAiSettings, voiceEngineOnboarded]);

  const handleSave = () => {
    AppSettings.getState().setAiName(settings.assistantName);
    AppSettings.getState().setAiLanguage(settings.language);
    AppSettings.getState().setAiActive(settings.aiActive);
    AppSettings.getState().setVoiceBackend(settings.voiceBackend);
    setToast("Settings saved", "success");
  };

  return (
    <View className="flex-1 bg-grey py-5 dark:bg-dark">
      <View className="w-full flex-row items-center gap-x-5 px-4">
        <Pressable
          onPress={() => router.back()}
          className="rounded-full bg-white p-3 dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">AI Settings</CText>
      </View>

      <ScrollView
        className="w-11/12 flex-1 self-center p-2"
        contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {Items.map((item) => (
          <View
            key={item.id}
            className="flex flex-col rounded-2xl bg-white py-4 dark:bg-accent"
          >
            <View className="flex-row items-center justify-between px-4 py-2">
              <CText style={{ fontFamily: "bold" }} className="text-[18px]">
                {item.title}
              </CText>
              {item.type === "toogle" ? (
                <Switch
                  trackColor={{ false: "red", true: "green" }}
                  thumbColor="white"
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={() => {
                    setSettings({ ...settings, aiActive: !settings.aiActive });
                  }}
                  value={settings.aiActive}
                />
              ) : null}
            </View>

            {item.subItems.length > 0 && item.type !== "voiceBackend" ? (
              <View className="border-b border-gray-200 dark:border-accent2" />
            ) : null}

            {item.type === "dropdown" ? (
              <View>
                <Pressable onPress={() => setToggleDropdown(true)} className="p-4">
                  <CText>{settings.language}</CText>
                </Pressable>
                {toggleDropdown ? (
                  <View className="absolute z-50 w-full rounded-2xl bg-white dark:bg-accent">
                    {item.subItems.map((subItem) => (
                      <Pressable
                        key={subItem.title}
                        onPress={() => {
                          setSettings({ ...settings, language: subItem.title });
                          setToggleDropdown(false);
                        }}
                        className="p-4"
                      >
                        <CText style={{ fontFamily: "bold" }}>{subItem.title}</CText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {item.type === "voiceBackend" ? (
              <View className="gap-y-3 px-4 pb-2">
                <CText className="text-[0.86rem] leading-5 text-black/65 dark:text-grey/75">
                  {settings.voiceBackend === "qvac"
                    ? `Private AI runs on your phone and may download about ${QVAC_MODEL_STORAGE_ESTIMATE_GB} GB of models.`
                    : "Public AI uses cloud voice — light on storage, needs internet."}
                </CText>
                <Pressable
                  onPress={() => router.push("/aisetup/voice-engine")}
                  className="self-start"
                >
                  <CText className="text-[0.86rem] text-purple">
                    Review public vs private AI
                  </CText>
                </Pressable>
                <VoiceEnginePicker
                  compact
                  selected={settings.voiceBackend}
                  onSelect={(backend: VoiceBackend) =>
                    setSettings({ ...settings, voiceBackend: backend })
                  }
                />
                <CText className="text-[0.8rem] text-black/50 dark:text-grey/60">
                  Current: {labelForVoiceBackend(settings.voiceBackend)}
                </CText>
              </View>
            ) : null}

            {item.type === "input" ? (
              <TextInput
                style={{ fontFamily: "reg" }}
                value={settings.assistantName}
                className="w-full px-5 py-3 text-start text-black dark:text-white"
                onChangeText={(text) => {
                  setSettings({ ...settings, assistantName: text });
                }}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View className="w-11/12 gap-y-3 self-center p-2">
        <Buttons onPress={() => handleSave()} text="Save" type="primary" />
      </View>
    </View>
  );
}
