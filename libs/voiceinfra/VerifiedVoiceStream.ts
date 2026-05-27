import { Audio } from "expo-av";
import AudioRecord from "react-native-audio-record";
import { Buffer } from "buffer";
import { verifyVoiceCommand } from "@/services/voiceAuthApi";

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
const VERIFY_TIMEOUT_MS = 12_000;

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

  constructor(private options: VerifiedVoiceStreamOptions) {}

  async start(): Promise<void> {
    if (!this.stopped) return;

    await ensurePermission();

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

    if (!suppressed) {
      this.emitState("listening");
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
    this.hasSpeech = false;
    this.lastSpeechAt = 0;
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
        this.maxUtteranceTimer = setTimeout(() => {
          void this.flush();
        }, MAX_UTTERANCE_MS);
      }

      this.chunks.push(chunk);
      this.byteLength += chunk.length;

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
    if (
      this.stopped ||
      this.suppressed ||
      this.verifying ||
      !this.hasSpeech
    ) {
      return;
    }

    const audio = Buffer.concat(this.chunks, this.byteLength);
    this.clearBuffer();
    this.clearTimers();
    this.resetUtteranceState();

    if (audio.length < MIN_UTTERANCE_BYTES) {
      this.emitState("listening");
      return;
    }

    this.verifying = true;
    this.emitState("verifying");
    try {
      const audioBase64 = audio.toString("base64");
      const result = await this.withTimeout(
        verifyVoiceCommand({
          walletAddress: this.options.walletAddress,
          audio: audioBase64,
          adapt: true,
        }),
        VERIFY_TIMEOUT_MS
      );

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
      this.options.onVerifiedCommand(transcript, audioBase64);
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
    }
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
    normalized.includes("could not decode audio")
  );
}
