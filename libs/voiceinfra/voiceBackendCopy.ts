import type { QvacHostMode, VoiceBackend } from "./types";

export const QVAC_MODEL_STORAGE_ESTIMATE_GB = 1;

export type VoiceBackendOption = {
  id: VoiceBackend;
  title: string;
  badge: string;
  summary: string;
  pros: string[];
  cons: string[];
};

export type QvacHostModeOption = {
  id: QvacHostMode;
  title: string;
  badge: string;
  summary: string;
};

export const qvacHostModeOptions: QvacHostModeOption[] = [
  {
    id: "laptop",
    title: "My laptop (recommended)",
    badge: "Best for most phones",
    summary:
      "Your phone captures mic audio and plays replies, but Whisper, Llama, and TTS run on a computer you control. Pair over your local Wi‑Fi address shown in Voice Host.",
  },
  {
    id: "device",
    title: "This phone",
    badge: "Fully offline after download",
    summary:
      "All models run on-device. Needs about 1 GB of storage and enough RAM — may not work on older or low-memory devices.",
  },
];

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
    title: "Private AI (QVAC)",
    badge: "Best for privacy",
    summary:
      "Speech recognition, the language model, and text-to-speech stay off the cloud. Run models on your laptop (recommended) or directly on your phone if it has enough memory.",
    pros: [
      "Conversations are not sent to the cloud for AI inference",
      "Laptop mode keeps your phone light — no model download on the device",
      "You stay in control of what leaves your phone",
    ],
    cons: [
      "Laptop mode needs HeySolana Voice Host running on your computer and on the same network",
      "On-phone mode downloads about 1 GB and uses significant RAM",
      "Wallet tool calls are limited compared to cloud mode today",
    ],
  },
];

export const voiceEngineOnboardingIntro = {
  title: "Choose how Orova listens and thinks",
  subtitle:
    "Pick where your voice assistant runs. You can change this later in AI Settings.",
  storageNote:
    "Private AI can run on your laptop so your phone does not load heavy models. Public AI uses the cloud and keeps your install light.",
};

export function labelForVoiceBackend(backend: VoiceBackend): string {
  return (
    voiceBackendOptions.find((option) => option.id === backend)?.title ??
    (backend === "qvac" ? "Private AI (QVAC)" : "Public AI (cloud)")
  );
}

export function labelForQvacHostMode(mode: QvacHostMode): string {
  return (
    qvacHostModeOptions.find((option) => option.id === mode)?.title ??
    (mode === "laptop" ? "My laptop" : "This phone")
  );
}
