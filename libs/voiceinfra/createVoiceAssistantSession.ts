import type { Connection } from "@solana/web3.js";

import AppSettings from "@/utils/store/settingsstore.store";
import type { userWalletType } from "@/utils/store/userstore.store";

import { OpenAiVoiceSession } from "./OpenAiVoiceSession";
import { QvacVoiceSession } from "./QvacVoiceSession";
import type {
  VoiceAssistantSession,
  VoiceBackend,
  VoiceSessionCallbacks,
} from "./types";

export function resolveVoiceBackend(
  override?: VoiceBackend
): VoiceBackend {
  const fromSettings = AppSettings.getState().voiceBackend;
  if (override) return override;
  if (fromSettings) return fromSettings;

  const fromEnv = process.env.EXPO_PUBLIC_VOICE_BACKEND;
  if (fromEnv === "qvac" || fromEnv === "openai") {
    return fromEnv;
  }

  return "openai";
}

export function createVoiceAssistantSession(
  userWallet: userWalletType,
  connection: Connection,
  callbacks: VoiceSessionCallbacks,
  backendOverride?: VoiceBackend
): VoiceAssistantSession {
  const backend = resolveVoiceBackend(backendOverride);

  if (backend === "qvac") {
    return new QvacVoiceSession(connection, callbacks);
  }

  return new OpenAiVoiceSession(userWallet, connection, callbacks);
}

export type { VoiceAssistantSession, VoiceBackend, VoiceSessionCallbacks };
