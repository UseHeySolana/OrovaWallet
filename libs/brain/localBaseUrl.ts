import { Platform } from "react-native";

/**
 * Best-effort default base URL for a local OpenAI-compatible server.
 *
 * Notes:
 * - Android emulator uses 10.0.2.2 to reach host machine localhost.
 * - iOS simulator usually can use 127.0.0.1.
 * - Physical devices cannot reach your dev machine via localhost; require LAN IP override.
 */
export function defaultLocalOpenAIBaseUrl(): string {
  const host =
    Platform.OS === "android"
      ? "http://10.0.2.2:11434"
      : "http://127.0.0.1:11434";
  return `${host}/v1`;
}

