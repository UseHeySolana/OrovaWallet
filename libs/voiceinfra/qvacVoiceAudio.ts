import { Buffer } from "buffer";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { File, Paths } from "expo-file-system";
import InCallManager from "react-native-incall-manager";

export const MIC_SAMPLE_RATE = 16_000;
export const TTS_SAMPLE_RATE = 44_100;

export function isMeaningfulTranscript(text: string, minChars = 3): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.includes("[No speech detected]")) return false;
  if (/^\[[^\]]+\]$/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length >= minChars;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strip markdown / unsupported chars before Supertonic TTS (e.g. backtick U+0060). */
export function sanitizeTextForTts(text: string): string {
  let spoken = text.trim();
  if (!spoken) return spoken;

  spoken = spoken.replace(/```[\s\S]*?```/g, " ");
  spoken = spoken.split("`").join("");
  spoken = spoken.split("\u0060").join("");
  spoken = spoken.replace(/\*\*([^*]+)\*\*/g, "$1");
  spoken = spoken.replace(/\*([^*]+)\*/g, "$1");
  spoken = spoken.replace(/__([^_]+)__/g, "$1");
  spoken = spoken.replace(/_([^_]+)_/g, "$1");
  spoken = spoken.replace(/^#{1,6}\s+/gm, "");
  spoken = spoken.replace(/^[\s]*[-*•]\s+/gm, "");
  spoken = spoken.replace(/^\s*\d+\.\s+/gm, "");
  spoken = spoken.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  spoken = spoken.replace(/[\u2018\u2019]/g, "'");
  spoken = spoken.replace(/[\u201C\u201D]/g, '"');
  spoken = spoken.replace(/[\u2013\u2014]/g, ", ");

  const allowedPunct = " .,!?'-$%/+:;()";
  let cleaned = "";
  for (let i = 0; i < spoken.length; i += 1) {
    const ch = spoken[i]!;
    const code = ch.charCodeAt(0);
    if (code === 0x60) continue;
    if (code >= 0x30 && code <= 0x39) {
      cleaned += ch;
      continue;
    }
    if (code >= 0x41 && code <= 0x5a) {
      cleaned += ch;
      continue;
    }
    if (code >= 0x61 && code <= 0x7a) {
      cleaned += ch;
      continue;
    }
    if (code >= 0xc0 && code <= 0x024f) {
      cleaned += ch;
      continue;
    }
    if (allowedPunct.includes(ch)) {
      cleaned += ch;
      continue;
    }
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
      cleaned += " ";
    }
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

/** Last-resort scrub immediately before Supertonic synthesis. */
export function scrubForSupertonic(text: string): string {
  return sanitizeTextForTts(text).split("`").join("").split("\u0060").join("");
}

/** Convert react-native-audio-record base64 int16 PCM to f32le for QVAC Whisper. */
export function int16Base64ToF32Buffer(base64: string): Buffer {
  const int16Buf = Buffer.from(base64, "base64");
  const sampleCount = Math.floor(int16Buf.length / 2);
  const f32 = Buffer.alloc(sampleCount * 4);

  for (let i = 0; i < sampleCount; i += 1) {
    const sample = int16Buf.readInt16LE(i * 2) / 32_768;
    f32.writeFloatLE(sample, i * 4);
  }

  return f32;
}

export function int16ArrayToBuffer(samples: ArrayLike<number>): Buffer {
  const buffer = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-32_768, Math.min(32_767, Math.round(samples[i] ?? 0)));
    buffer.writeInt16LE(value, i * 2);
  }
  return buffer;
}

export function createWavHeader(
  dataLength: number,
  sampleRate: number,
  channels = 1,
  bitsPerSample = 16
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

function estimateWavDurationMs(wavBuffer: Buffer): number {
  if (wavBuffer.length < 44) return 30_000;
  const sampleRate = wavBuffer.readUInt32LE(24);
  const dataBytes = wavBuffer.length - 44;
  if (!sampleRate || dataBytes <= 0) return 30_000;
  return Math.ceil((dataBytes / 2 / sampleRate) * 1000) + 1500;
}

export async function playWavBuffer(wavBuffer: Buffer): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
  });

  InCallManager.start({ media: "audio", auto: false, ringback: "" });
  InCallManager.setSpeakerphoneOn(true);

  const file = new File(Paths.cache, `qvac-tts-${Date.now()}.wav`);

  try {
    file.create({ overwrite: true });
    file.write(new Uint8Array(wavBuffer));

    const { sound } = await Audio.Sound.createAsync(
      { uri: file.uri },
      { shouldPlay: true, volume: 1.0 }
    );

    const maxWaitMs = Math.max(estimateWavDurationMs(wavBuffer), 5_000);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const unload = sound.unloadAsync();
        void Promise.resolve(unload).finally(() => {
          if (error) reject(error);
          else resolve();
        });
      };

      const timeout = setTimeout(() => finish(), maxWaitMs);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if ("error" in status && status.error) {
            finish(new Error(String(status.error)));
          }
          return;
        }
        if (status.didJustFinish) {
          finish();
        }
      });
    });
  } finally {
    InCallManager.stop();
    try {
      if (file.exists) {
        file.delete();
      }
    } catch {
      // ignore temp file cleanup errors
    }
  }
}
