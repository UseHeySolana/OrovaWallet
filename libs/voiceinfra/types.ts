import type { Connection } from "@solana/web3.js";

export type VoiceBackend = "openai" | "qvac";

export type VoiceSessionMode = "loading" | "human" | "aispeaking";

export interface VoiceSessionCallbacks {
  setMode: (mode: VoiceSessionMode) => void;
  setConversationId: (id: string) => void;
  onAssistantPlaybackActive?: (active: boolean) => void;
  onAssistantResponseEnded?: () => void;
}

/** Shared contract for AiContext and wallet tool handlers. */
export interface VoiceAssistantSession {
  readonly connection: Connection;
  functionMessageId: string | null;

  startSession(
    systemInstructions?: string,
    options?: { useAudio?: boolean }
  ): Promise<void>;
  stopSession(): Promise<void>;
  isActive(): boolean;
  isChatInputSession(): boolean;

  sendTextMessage(message: string): void;
  sendVerifiedAudioChunk?(audioBase64: string): void;

  toggleSpeaker?(speakerOn: boolean): void;
  muteSpeaker?(muted: boolean): void;
  muteMic?(muted: boolean): void;
}
