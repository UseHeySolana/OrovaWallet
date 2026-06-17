import { Buffer } from "buffer";
import { Audio } from "expo-av";

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

export function int16ArrayToBuffer(samples: Int16Array): Buffer {
  return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
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

export async function playWavBuffer(wavBuffer: Buffer): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const base64 = wavBuffer.toString("base64");
  const { sound } = await Audio.Sound.createAsync(
    { uri: `data:audio/wav;base64,${base64}` },
    { shouldPlay: true }
  );

  await new Promise<void>((resolve, reject) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        void sound.unloadAsync().then(() => resolve()).catch(reject);
      }
      if ("error" in status && status.error) {
        reject(new Error(String(status.error)));
      }
    });
  });
}
