import {
  heartbeat,
  loadModel,
  EMBEDDINGGEMMA_300M_Q4_0,
  LLAMA_3_2_1B_INST_Q4_0,
  QWEN3_600M_INST_Q4,
  TTS_EN_SUPERTONIC_Q8_0,
  VAD_SILERO_5_1_2,
  WHISPER_TINY,
} from "@qvac/sdk";

import { QVAC_DELEGATE_TIMEOUT_MS } from "@/libs/qvac/constants";
import type { QvacHostMode } from "./types";

/** First delegated connect can be slow while Hyperswarm bootstraps. */
const LAPTOP_PREFLIGHT_TIMEOUT_MS = 45_000;

export const QVAC_VOICE_VAD_PARAMS = {                                                
  // Lower threshold so normal speaking volume triggers VAD reliably.
  threshold: 0.4,
  min_speech_duration_ms: 200,
  min_silence_duration_ms: 600,
  max_speech_duration_s: 15.0,
  speech_pad_ms: 200,
};

export type QvacVoiceModelIds = {
  asrModelId: string;
  /** Llama — natural chat / voice replies (no tool calling). */
  chatModelId: string;
  /** Qwen — wallet tool selection and execution. */
  toolModelId: string;
  ttsModelId: string;
  embedModelId: string;
};

function buildDelegate(providerPublicKey: string) {
  return {
    providerPublicKey: providerPublicKey.trim(),
    timeout: QVAC_DELEGATE_TIMEOUT_MS,
    fallbackToLocal: false,
  };
}

/**
 * Load Whisper + VAD, Llama (chat), Qwen (tools), embeddings, and TTS.
 * On laptop mode, inference runs on the remote provider.
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

  if (input.hostMode === "laptop" && delegate?.providerPublicKey) {
    input.onProgress?.("Connecting to laptop", 0);
    await heartbeat({
      delegate: {
        providerPublicKey: delegate.providerPublicKey,
        timeout: LAPTOP_PREFLIGHT_TIMEOUT_MS,
      },
    });
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

  const chatModelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: "llamacpp-completion",
    modelConfig: { ctx_size: 4096 },
    delegate,
    onProgress: (progress) => {
      input.onProgress?.("Chat language model (Llama)", progress.percentage);
    },
  });

  const toolModelId = await loadModel({
    modelSrc: QWEN3_600M_INST_Q4,
    modelType: "llamacpp-completion",
    modelConfig: {
      ctx_size: 4096,
      tools: true,
    },
    delegate,
    onProgress: (progress) => {
      input.onProgress?.("Tool language model (Qwen)", progress.percentage);
    },
  });

  const embedModelId = await loadModel({
    modelSrc: EMBEDDINGGEMMA_300M_Q4_0,
    modelType: "llamacpp-embedding",
    delegate,
    onProgress: (progress) => {
      input.onProgress?.("Embedding model", progress.percentage);
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

  return { asrModelId, chatModelId, toolModelId, ttsModelId, embedModelId };
}
