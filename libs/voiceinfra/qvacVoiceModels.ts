import {
  loadModel,
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_EN_SUPERTONIC_Q8_0,
  VAD_SILERO_5_1_2,
  WHISPER_TINY,
} from "@qvac/sdk";

import { QVAC_DELEGATE_TIMEOUT_MS } from "@/libs/qvac/constants";
import type { QvacHostMode } from "./types";

export const QVAC_VOICE_VAD_PARAMS = {
  threshold: 0.6,
  min_speech_duration_ms: 300,
  min_silence_duration_ms: 700,
  max_speech_duration_s: 15.0,
  speech_pad_ms: 200,
};

export type QvacVoiceModelIds = {
  asrModelId: string;
  llmModelId: string;
  ttsModelId: string;
};

function buildDelegate(providerPublicKey: string) {
  return {
    providerPublicKey: providerPublicKey.trim(),
    timeout: QVAC_DELEGATE_TIMEOUT_MS,
    fallbackToLocal: false,
  };
}

/**
 * Load Whisper + VAD, LLM, and TTS for the voice assistant loop.
 * On laptop mode, inference runs on the remote provider — no local model weights on phone.
 */
export async function loadQvacVoiceModels(input: {
  hostMode: QvacHostMode;
  laptopProviderPublicKey?: string;
  onProgress?: (label: string, percentage: number) => void;
}): Promise<QvacVoiceModelIds> {
  const delegate =
    input.hostMode === "laptop"
      ? buildDelegate(input.laptopProviderPublicKey ?? "")
      : undefined;

  if (input.hostMode === "laptop" && !delegate?.providerPublicKey) {
    throw new Error(
      "Add your laptop provider public key in AI Settings before starting private voice."
    );
  }

  const asrModelId = await loadModel({
    modelSrc: WHISPER_TINY,
    modelType: "whispercpp-transcription",
    modelConfig: {
      vadModelSrc: VAD_SILERO_5_1_2,
      audio_format: "f32le",
      strategy: "greedy",
      n_threads: 4,
      language: "en",
      no_timestamps: true,
      suppress_blank: true,
      suppress_nst: true,
      temperature: 0.0,
      vad_params: QVAC_VOICE_VAD_PARAMS,
    },
    delegate,
    onProgress: (progress) => {
      input.onProgress?.("Speech recognition", progress.percentage);
    },
  });

  const llmModelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: "llamacpp-completion",
    modelConfig: { ctx_size: 4096 },
    delegate,
    onProgress: (progress) => {
      input.onProgress?.("Language model", progress.percentage);
    },
  });

  const ttsModelId = await loadModel({
    modelSrc: TTS_EN_SUPERTONIC_Q8_0,
    modelType: "tts-ggml",
    modelConfig: {
      ttsEngine: "supertonic",
      language: "en",
      voice: "F1",
      ttsSpeed: 1.05,
      ttsNumInferenceSteps: 5,
    },
    delegate,
    onProgress: (progress) => {
      input.onProgress?.("Speech synthesis", progress.percentage);
    },
  });

  return { asrModelId, llmModelId, ttsModelId };
}
