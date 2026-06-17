import type { Connection } from "@solana/web3.js";

import type { userWalletType } from "@/utils/store/userstore.store";

import SessionManager from "./SessionManager";
import type { VoiceAssistantSession, VoiceSessionCallbacks } from "./types";

/** OpenAI Realtime (WebRTC) voice session — thin adapter over SessionManager. */
export class OpenAiVoiceSession implements VoiceAssistantSession {
  private readonly inner: SessionManager;

  constructor(
    userWallet: userWalletType,
    connection: Connection,
    callbacks: VoiceSessionCallbacks
  ) {
    this.inner = new SessionManager(userWallet, connection, callbacks);
  }

  get connection(): Connection {
    return this.inner.connection;
  }

  get functionMessageId(): string | null {
    return this.inner.functionMessageId;
  }

  set functionMessageId(value: string | null) {
    this.inner.functionMessageId = value;
  }

  startSession(
    systemInstructions?: string,
    options?: { useAudio?: boolean }
  ): Promise<void> {
    return this.inner.startSession(systemInstructions, options);
  }

  stopSession(): Promise<void> {
    return this.inner.stopSession();
  }

  isActive(): boolean {
    return this.inner.isActive();
  }

  isChatInputSession(): boolean {
    return this.inner.isChatInputSession();
  }

  sendTextMessage(message: string): void {
    this.inner.sendTextMessage(message);
  }

  sendVerifiedAudioChunk(audioBase64: string): void {
    this.inner.sendVerifiedAudioChunk(audioBase64);
  }

  toggleSpeaker(speakerOn: boolean): void {
    this.inner.toggleSpeaker(speakerOn);
  }

  muteSpeaker(muted: boolean): void {
    this.inner.muteSpeaker(muted);
  }

  muteMic(muted: boolean): void {
    this.inner.muteMic(muted);
  }
}
