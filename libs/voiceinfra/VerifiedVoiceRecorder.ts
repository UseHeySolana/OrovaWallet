import { Audio } from "expo-av";
import AudioRecord from "react-native-audio-record";
import RNFS from "react-native-fs";

let initialized = false;
let hasDataListener = false;

async function ensurePermission(): Promise<void> {
  const { status } = await Audio.getPermissionsAsync();
  if (status === "granted") return;

  const { status: nextStatus } = await Audio.requestPermissionsAsync();
  if (nextStatus !== "granted") {
    throw new Error("Microphone permission is required for voice verification");
  }
}

export async function startVerifiedVoiceRecording(): Promise<void> {
  await ensurePermission();

  if (!initialized) {
    AudioRecord.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      wavFile: "verified_voice_command.wav",
    });
    if (!hasDataListener && typeof AudioRecord.on === "function") {
      // react-native-audio-record emits live chunks even though we read the final WAV file.
      // Registering a no-op listener prevents NativeEventEmitter warning spam.
      AudioRecord.on("data", () => {});
      hasDataListener = true;
    }
    initialized = true;
  }

  AudioRecord.start();
}

export async function stopVerifiedVoiceRecording(): Promise<string> {
  const filePath = await AudioRecord.stop();
  if (!filePath) {
    throw new Error("Voice recording did not produce an audio file");
  }

  const normalizedPath = filePath.startsWith("file://")
    ? filePath.replace("file://", "")
    : filePath;

  return RNFS.readFile(normalizedPath, "base64");
}
