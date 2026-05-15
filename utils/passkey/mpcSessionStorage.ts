import * as SecureStore from "expo-secure-store";

const MPC_SESSION_KEY = "mpcSessionToken_v1";

export async function getStoredMpcSession(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(MPC_SESSION_KEY);
  } catch {
    return null;
  }
}

export async function setStoredMpcSession(token: string): Promise<void> {
  await SecureStore.setItemAsync(MPC_SESSION_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearMpcSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MPC_SESSION_KEY);
  } catch {
    // ignore
  }
}
