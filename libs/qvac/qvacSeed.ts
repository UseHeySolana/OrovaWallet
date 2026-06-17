import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const SEED_KEY = "qvac_hyperswarm_seed_v1";

/**
 * Stable Hyperswarm identity per install (64-char hex).
 * Must be set before the first `startQVACProvider()` call.
 */
export async function ensureQvacHyperswarmSeed(): Promise<string> {
  let seed = await SecureStore.getItemAsync(SEED_KEY);
  if (!seed) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    seed = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await SecureStore.setItemAsync(SEED_KEY, seed, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  process.env.QVAC_HYPERSWARM_SEED = seed;
  return seed;
}
