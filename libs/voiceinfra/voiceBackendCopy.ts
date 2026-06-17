import type { VoiceBackend } from "./types";

export const QVAC_MODEL_STORAGE_ESTIMATE_GB = 1;

export type VoiceBackendOption = {
  id: VoiceBackend;
  title: string;
  badge: string;
  summary: string;
  pros: string[];
  cons: string[];
};

export const voiceBackendOptions: VoiceBackendOption[] = [
  {
    id: "openai",
    title: "Public AI (cloud)",
    badge: "Recommended for most users",
    summary:
      "Orova runs on OpenAI’s realtime voice service. Your mic audio and messages are sent to the cloud so the assistant can hear you, think, and speak back.",
    pros: [
      "Smallest install — almost no extra storage on your phone",
      "Fast, high-quality voice with full wallet tools (swap, send, search)",
      "Works best on slower or older devices",
    ],
    cons: [
      "Requires a stable internet connection",
      "Voice and text are processed on third-party servers",
      "Usage may count toward cloud API limits",
    ],
  },
  {
    id: "qvac",
    title: "Private AI (on your phone)",
    badge: "Best for privacy",
    summary:
      "Speech recognition, the language model, and text-to-speech all run locally with QVAC. After the first download, conversations can stay entirely on your device.",
    pros: [
      "Conversations are not sent to the cloud for AI inference",
      "Works offline once models are downloaded",
      "You stay in control of what leaves your phone",
    ],
    cons: [
      `First setup downloads about ${QVAC_MODEL_STORAGE_ESTIMATE_GB} GB of models`,
      "Uses more battery, RAM, and storage while the assistant is active",
      "Wallet tool calls are limited compared to cloud mode today",
      "First response may be slower while models load",
    ],
  },
];

export const voiceEngineOnboardingIntro = {
  title: "Choose how Orova listens and thinks",
  subtitle:
    "Pick where your voice assistant runs. You can change this later in AI Settings.",
  storageNote:
    "Private AI keeps inference on your phone but needs extra space for Whisper, Llama, and speech models. Public AI uses the cloud and keeps your install light.",
};

export function labelForVoiceBackend(backend: VoiceBackend): string {
  return (
    voiceBackendOptions.find((option) => option.id === backend)?.title ??
    (backend === "qvac" ? "Private AI (on your phone)" : "Public AI (cloud)")
  );
}
