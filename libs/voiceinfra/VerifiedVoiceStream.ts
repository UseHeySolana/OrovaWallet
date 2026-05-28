import { Audio } from "expo-av";
import AudioRecord from "react-native-audio-record";
import { Buffer } from "buffer";
import {
  completeVoiceStreamVerification,
  createVoiceStreamSession,
  fetchVoiceStatus,
  verifyVoiceCommand,
} from "@/services/voiceAuthApi";
import {
  VoiceStreamServerMessage,
  VoiceStreamSocket,
} from "@/libs/voiceinfra/voiceStreamSocket";

type VerifiedVoiceStreamOptions = {
  walletAddress: string;
  /** Called after speaker verification with the Laravel/OpenAI transcript (not raw audio). */
  onVerifiedCommand: (transcript: string, audioBase64: string) => void;
  onStateChange?: (state: "listening" | "hearing" | "verifying" | "verified") => void;
  onError?: (error: Error) => void;
};

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const CHANNELS = 1;
const BYTES_PER_SECOND = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS;
/** ECAPA requires >=1.0s speech after trim; capture extra for silence padding. */
const MIN_UTTERANCE_SECONDS = 1.2;
const MIN_UTTERANCE_BYTES = Math.ceil(BYTES_PER_SECOND * MIN_UTTERANCE_SECONDS);
const SPEECH_RMS = 0.009;
const SILENCE_AFTER_SPEECH_MS = 1800;
const MAX_UTTERANCE_MS = 20_000;
const DUPLICATE_TRANSCRIPT_WINDOW_MS = 5000;
const HEARING_STATE_RESET_MS = 1200;
const VERIFIED_STATE_RESET_MS = 1200;
const VERIFY_TIMEOUT_MS = 18_000;
const STREAM_SETUP_TIMEOUT_MS = 8_000;

let initialized = false;
let activeStream: VerifiedVoiceStream | null = null;

async function ensurePermission(): Promise<void> {
  const { status } = await Audio.getPermissionsAsync();
  if (status === "granted") return;

  const { status: nextStatus } = await Audio.requestPermissionsAsync();
  if (nextStatus !== "granted") {
    throw new Error("Microphone permission is required for voice verification");
  }
}

function calculateRms(buffer: Buffer): number {
  const length = buffer.length - (buffer.length % BYTES_PER_SAMPLE);
  if (length <= 0) return 0;

  let sumSquares = 0;
  let sampleCount = 0;

  for (let i = 0; i < length; i += BYTES_PER_SAMPLE) {
    const value = buffer.readInt16LE(i) / 32768;
    sumSquares += value * value;
    sampleCount += 1;
  }

  return Math.sqrt(sumSquares / Math.max(1, sampleCount));
}

/** Reject empty or accidental base64 audio payloads used as transcript fallbacks. */
function isUsableTranscript(transcript: string): boolean {
  const trimmed = transcript.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (trimmed.length > 800 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return false;
  }
  return true;
}

export class VerifiedVoiceStream {
  private chunks: Buffer[] = [];
  private byteLength = 0;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxUtteranceTimer: ReturnType<typeof setTimeout> | null = null;
  private stateResetTimer: ReturnType<typeof setTimeout> | null = null;
  private verifying = false;
  private stopped = true;
  private hasSpeech = false;
  private lastSpeechAt = 0;
  private lastTranscript = "";
  private lastTranscriptAt = 0;
  private lastHearingStateAt = 0;
  private suppressed = false;
  private currentState: "listening" | "hearing" | "verifying" | "verified" = "listening";

  private streamVerifyEnabled: boolean | null = null;
  private streamSocket: VoiceStreamSocket | null = null;
  private streamSessionId: string | null = null;
  private streamConnecting = false;
  private streamReady = false;
  private pendingStreamChunks: Buffer[] = [];
  private streamOutcomeResolver: ((message: VoiceStreamServerMessage) => void) | null = null;
  private lastStreamOutcome: VoiceStreamServerMessage | null = null;

  constructor(private options: VerifiedVoiceStreamOptions) {}

  async start(): Promise<void> {
    if (!this.stopped) return;

    await ensurePermission();
    await this.loadStreamCapability();

    if (!initialized) {
      AudioRecord.init({
        sampleRate: SAMPLE_RATE,
        channels: CHANNELS,
        bitsPerSample: 16,
        wavFile: "verified_voice_stream.wav",
      });

      AudioRecord.on("data", (data: string) => {
        activeStream?.handleData(data);
      });
      initialized = true;
    }

    activeStream = this;
    this.stopped = false;
    this.suppressed = false;
    this.chunks = [];
    this.byteLength = 0;
    this.resetUtteranceState();
    this.teardownStream();
    AudioRecord.start();
    this.emitState("listening");
  }

  async stop(): Promise<void> {
    if (this.stopped) return;

    this.stopped = true;
    this.clearTimers();
    if (this.stateResetTimer) {
      clearTimeout(this.stateResetTimer);
      this.stateResetTimer = null;
    }

    if (activeStream === this) {
      activeStream = null;
    }

    this.teardownStream();
    await AudioRecord.stop().catch(() => undefined);
    this.clearBuffer();
    this.resetUtteranceState();
  }

  setSuppressed(suppressed: boolean): void {
    if (this.stopped || this.suppressed === suppressed) return;

    this.suppressed = suppressed;
    this.clearBuffer();
    this.clearTimers();
    this.resetUtteranceState();
    this.teardownStream();

    if (!suppressed) {
      this.emitState("listening");
    }
  }

  private async loadStreamCapability(): Promise<void> {
    try {
      const status = await fetchVoiceStatus(this.options.walletAddress);
      this.streamVerifyEnabled =
        Boolean(status.voice_stream_verify_enabled) &&
        status.algorithm_version === "ecapa-v1" &&
        Boolean(status.enrolled);
    } catch {
      this.streamVerifyEnabled = false;
    }
  }

  private clearBuffer(): void {
    this.chunks = [];
    this.byteLength = 0;
  }

  private clearTimers(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxUtteranceTimer) {
      clearTimeout(this.maxUtteranceTimer);
      this.maxUtteranceTimer = null;
    }
  }

  private resetUtteranceState(): void {
    this.resetSpeechFlags();
    this.teardownStream();
  }

  private resetSpeechFlags(): void {
    this.hasSpeech = false;
    this.lastSpeechAt = 0;
  }

  private teardownStream(): void {
    this.streamSocket?.close();
    this.streamSocket = null;
    this.streamSessionId = null;
    this.streamConnecting = false;
    this.streamReady = false;
    this.pendingStreamChunks = [];
    this.streamOutcomeResolver = null;
    this.lastStreamOutcome = null;
  }

  private async ensureStreamConnection(): Promise<boolean> {
    if (this.streamVerifyEnabled === false) return false;
    if (this.streamReady && this.streamSocket) return true;
    if (this.streamConnecting) {
      return this.waitForStreamReady(STREAM_SETUP_TIMEOUT_MS);
    }

    this.streamConnecting = true;

    try {
      const session = await this.withTimeout(
        createVoiceStreamSession(this.options.walletAddress),
        STREAM_SETUP_TIMEOUT_MS
      );

      const socket = new VoiceStreamSocket({
        wsUrl: session.ws_url,
        onMessage: (message) => this.handleStreamMessage(message),
        onError: (error) => this.options.onError?.(error),
      });

      await this.withTimeout(socket.connect(), STREAM_SETUP_TIMEOUT_MS);

      this.streamSocket = socket;
      this.streamSessionId = session.session_id;
      this.streamReady = true;

      for (const pending of this.pendingStreamChunks) {
        socket.sendPcmChunk(new Uint8Array(pending));
      }
      this.pendingStreamChunks = [];

      return true;
    } catch {
      this.streamVerifyEnabled = false;
      this.teardownStream();
      return false;
    } finally {
      this.streamConnecting = false;
    }
  }

  private waitForStreamReady(timeoutMs: number): Promise<boolean> {
    const started = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (this.streamReady) {
          resolve(true);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  private handleStreamMessage(message: VoiceStreamServerMessage): void {
    if (message.type === "state") {
      if (message.state === "hearing") {
        this.emitState("hearing", HEARING_STATE_RESET_MS);
      } else if (message.state === "verifying") {
        this.emitState("verifying");
      } else if (message.state === "listening" && !this.verifying) {
        this.emitState("listening");
      }
      return;
    }

    if (message.type === "progress") {
      if (!this.verifying) {
        this.emitState("hearing", HEARING_STATE_RESET_MS);
      }
      return;
    }

    if (message.type === "verified" || message.type === "rejected" || message.type === "error") {
      if (this.streamOutcomeResolver) {
        this.streamOutcomeResolver(message);
        this.streamOutcomeResolver = null;
      } else {
        this.lastStreamOutcome = message;
      }
    }
  }

  private handleData(data: string): void {
    if (this.stopped || this.suppressed || this.verifying || !data) return;

    try {
      const chunk = Buffer.from(data, "base64");
      if (!chunk.length) return;

      const now = Date.now();
      const rms = calculateRms(chunk);
      const isSpeech = rms >= SPEECH_RMS;

      if (!this.hasSpeech) {
        if (!isSpeech) return;

        this.hasSpeech = true;
        this.lastSpeechAt = now;
        this.clearBuffer();
        void this.ensureStreamConnection();
        this.maxUtteranceTimer = setTimeout(() => {
          void this.flush();
        }, MAX_UTTERANCE_MS);
      }

      this.chunks.push(chunk);
      this.byteLength += chunk.length;

      if (this.streamReady && this.streamSocket) {
        this.streamSocket.sendPcmChunk(new Uint8Array(chunk));
      } else if (this.streamVerifyEnabled !== false) {
        this.pendingStreamChunks.push(chunk);
      }

      if (isSpeech) {
        this.lastSpeechAt = now;
      }

      if (isSpeech && now - this.lastHearingStateAt > 500) {
        this.lastHearingStateAt = now;
        this.emitState("hearing", HEARING_STATE_RESET_MS);
      }

      if (isSpeech || !this.silenceTimer) {
        this.scheduleSilenceFlush();
      }
    } catch {
      // Drop malformed audio chunks; the next valid chunk will continue the stream.
    }
  }

  private scheduleSilenceFlush(): void {
    if (!this.hasSpeech || this.stopped || this.suppressed) return;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      void this.tryEndUtterance();
    }, SILENCE_AFTER_SPEECH_MS);
  }

  private tryEndUtterance(): void {
    if (!this.hasSpeech || this.stopped || this.suppressed || this.verifying) {
      return;
    }

    const silenceMs = Date.now() - this.lastSpeechAt;
    if (silenceMs < SILENCE_AFTER_SPEECH_MS) {
      this.scheduleSilenceFlush();
      return;
    }

    if (this.byteLength < MIN_UTTERANCE_BYTES) {
      this.clearBuffer();
      this.clearTimers();
      this.resetUtteranceState();
      this.emitState("listening");
      return;
    }

    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.stopped || this.suppressed || this.verifying || !this.hasSpeech) {
      return;
    }

    const audio = Buffer.concat(this.chunks, this.byteLength);
    this.clearBuffer();
    this.clearTimers();
    this.resetSpeechFlags();

    if (audio.length < MIN_UTTERANCE_BYTES) {
      this.emitState("listening");
      return;
    }

    this.verifying = true;
    this.emitState("verifying");

    const useStream =
      this.streamVerifyEnabled !== false &&
      (this.streamReady || (await this.ensureStreamConnection()));

    try {
      const result = useStream
        ? await this.verifyWithStream(audio)
        : await this.verifyWithHttp(audio);

      if (!result.verified) {
        this.emitState("listening");
        return;
      }

      const transcript = result.transcript?.trim() ?? "";
      if (isUsableTranscript(transcript) && this.isDuplicateTranscript(transcript)) {
        this.emitState("listening");
        return;
      }

      if (isUsableTranscript(transcript)) {
        this.lastTranscript = transcript;
        this.lastTranscriptAt = Date.now();
      }
      this.emitState("verified", VERIFIED_STATE_RESET_MS);
      this.options.onVerifiedCommand(
        transcript,
        audio.toString("base64")
      );
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : String(error?.message ?? error);
      if (!isRecoverableVerifyError(message)) {
        this.options.onError?.(
          error instanceof Error ? error : new Error(message)
        );
      }
      this.emitState("listening");
    } finally {
      this.verifying = false;
      this.teardownStream();
    }
  }

  private async verifyWithHttp(audio: Buffer) {
    const audioBase64 = audio.toString("base64");
    return this.withTimeout(
      verifyVoiceCommand({
        walletAddress: this.options.walletAddress,
        audio: audioBase64,
        adapt: true,
      }),
      VERIFY_TIMEOUT_MS
    );
  }

  private async verifyWithStream(audio: Buffer) {
    if (!this.streamSocket || !this.streamSessionId) {
      throw new Error("Voice stream is not connected");
    }

    for (const pending of this.pendingStreamChunks) {
      this.streamSocket.sendPcmChunk(new Uint8Array(pending));
    }
    this.pendingStreamChunks = [];

    let streamMessage = this.lastStreamOutcome;
    this.lastStreamOutcome = null;

    if (!streamMessage) {
      streamMessage = await this.withTimeout(
        new Promise<VoiceStreamServerMessage>((resolve, reject) => {
          this.streamOutcomeResolver = resolve;
          this.streamSocket?.endUtterance();
          setTimeout(() => {
            if (this.streamOutcomeResolver) {
              this.streamOutcomeResolver = null;
              reject(new Error("Voice stream verification timeout"));
            }
          }, VERIFY_TIMEOUT_MS);
        }),
        VERIFY_TIMEOUT_MS
      );
    }

    if (streamMessage.type === "error") {
      throw new Error(streamMessage.message);
    }

    if (streamMessage.type === "rejected" || !("verified" in streamMessage) || !streamMessage.verified) {
      const rejection =
        streamMessage.type === "rejected"
          ? streamMessage
          : { rejection_reason: "speaker_not_recognized" as const, message: undefined, confidence: 0 };
      return {
        verified: false,
        enrolled: true,
        confidence: Number(rejection.confidence ?? 0),
        transcript: "",
        rejection_reason: rejection.rejection_reason ?? "speaker_not_recognized",
        message: rejection.message,
      };
    }

    return this.withTimeout(
      completeVoiceStreamVerification({
        walletAddress: this.options.walletAddress,
        sessionId: this.streamSessionId,
        adapt: true,
      }),
      VERIFY_TIMEOUT_MS
    );
  }

  private emitState(
    state: "listening" | "hearing" | "verifying" | "verified",
    resetAfterMs?: number
  ): void {
    if (this.stopped || this.suppressed) return;

    if (this.stateResetTimer) {
      clearTimeout(this.stateResetTimer);
      this.stateResetTimer = null;
    }

    if (this.currentState !== state) {
      this.currentState = state;
      this.options.onStateChange?.(state);
    }

    if (resetAfterMs) {
      this.stateResetTimer = setTimeout(() => {
        if (!this.stopped && !this.suppressed && !this.verifying) {
          this.emitState("listening");
        }
      }, resetAfterMs);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Voice verification timeout")),
            timeoutMs
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private isDuplicateTranscript(transcript: string): boolean {
    return (
      transcript.toLowerCase() === this.lastTranscript.toLowerCase() &&
      Date.now() - this.lastTranscriptAt < DUPLICATE_TRANSCRIPT_WINDOW_MS
    );
  }
}

function isRecoverableVerifyError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("too short") ||
    normalized.includes("second(s) of speech") ||
    normalized.includes("could not decode audio") ||
    normalized.includes("no clear speech") ||
    normalized.includes("not enough of your voice") ||
    normalized.includes("multiple voices detected") ||
    normalized.includes("voice not recognized") ||
    normalized.includes("utterance too short")
  );
}
