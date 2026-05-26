import { Audio } from "expo-av";
import AudioRecord from "react-native-audio-record";
import { Buffer } from "buffer";
import { verifyVoiceCommand } from "@/services/voiceAuthApi";

type VerifiedVoiceStreamOptions = {
  walletAddress: string;
  onVerifiedAudio: (audioBase64: string) => void;
  onStateChange?: (state: "listening" | "hearing" | "verifying" | "verified") => void;
  onError?: (error: Error) => void;
};

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const CHANNELS = 1;
const WINDOW_MS = 2200;
const MIN_WINDOW_BYTES = 16000;
const MIN_RMS = 0.012;
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

export class VerifiedVoiceStream {
  private chunks: Buffer[] = [];
  private byteLength = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private stateResetTimer: ReturnType<typeof setTimeout> | null = null;
  private verifying = false;
  private stopped = true;
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
    AudioRecord.start();
    this.emitState("listening");

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, WINDOW_MS);
  }

  async stop(): Promise<void> {
    if (this.stopped) return;

    this.stopped = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.stateResetTimer) {
      clearTimeout(this.stateResetTimer);
      this.stateResetTimer = null;
    }

    if (activeStream === this) {
      activeStream = null;
    }

    await AudioRecord.stop().catch(() => undefined);
    this.clearBuffer();
  }

  setSuppressed(suppressed: boolean): void {
    if (this.stopped || this.suppressed === suppressed) return;

    this.suppressed = suppressed;
    this.clearBuffer();

    if (!suppressed) {
      this.emitState("listening");
    }
  }

  private clearBuffer(): void {
    this.chunks = [];
    this.byteLength = 0;
  }

  private handleData(data: string): void {
    if (this.stopped || this.suppressed || !data) return;

    try {
      const chunk = Buffer.from(data, "base64");
      if (!chunk.length) return;

      this.chunks.push(chunk);
      this.byteLength += chunk.length;
      if (
        calculateRms(chunk) >= MIN_RMS &&
        Date.now() - this.lastHearingStateAt > 500
      ) {
        this.lastHearingStateAt = Date.now();
        this.emitState("hearing", HEARING_STATE_RESET_MS);
      }
    } catch {
      // Drop malformed audio chunks; the next valid chunk will continue the stream.
    }
  }

  private async flush(): Promise<void> {
    if (
      this.stopped ||
      this.suppressed ||
      this.verifying ||
      this.byteLength < MIN_WINDOW_BYTES
    ) {
      return;
    }

    const audio = Buffer.concat(this.chunks, this.byteLength);
    this.clearBuffer();

    if (calculateRms(audio) < MIN_RMS) {
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
          adapt: false,
        }),
        VERIFY_TIMEOUT_MS
      );

      if (!result.verified) {
        this.emitState("listening");
        return;
      }

      const transcript = result.transcript?.trim() || audioBase64;
      if (this.isDuplicateTranscript(transcript)) {
        this.emitState("listening");
        return;
      }

      this.lastTranscript = transcript;
      this.lastTranscriptAt = Date.now();
      this.emitState("verified", VERIFIED_STATE_RESET_MS);
      this.options.onVerifiedAudio(audioBase64);
    } catch (error: any) {
      this.options.onError?.(
        error instanceof Error ? error : new Error(error?.message ?? String(error))
      );
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
