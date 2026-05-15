import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";

const PASSKEY_CREDENTIAL_KEY = "passkeyCredential_v1";
const DEV_SIM_PASSKEY_KEY = "passkeyCredential_dev_sim_v1";

export const useDevSimulatorInsecureStore =
  typeof __DEV__ !== "undefined" && __DEV__ && !Device.isDevice;

export interface PasskeyCredentialRecord {
  credentialId: string;
  walletAddress: string;
  createdAt: string;
}

async function writeJson(key: string, value: string): Promise<void> {
  if (useDevSimulatorInsecureStore) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function readJson(key: string): Promise<string | null> {
  if (useDevSimulatorInsecureStore) {
    const dev = await AsyncStorage.getItem(DEV_SIM_PASSKEY_KEY);
    if (dev) return dev;
    return SecureStore.getItemAsync(PASSKEY_CREDENTIAL_KEY);
  }
  return SecureStore.getItemAsync(PASSKEY_CREDENTIAL_KEY);
}

export async function getPasskeyCredential(): Promise<PasskeyCredentialRecord | null> {
  const raw =
    (await readJson(
      useDevSimulatorInsecureStore ? DEV_SIM_PASSKEY_KEY : PASSKEY_CREDENTIAL_KEY
    )) ?? null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PasskeyCredentialRecord;
  } catch {
    return null;
  }
}

export async function hasPasskeyForWallet(walletAddress: string): Promise<boolean> {
  const cred = await getPasskeyCredential();
  return cred?.walletAddress === walletAddress;
}

/**
 * Device-bound passkey registration (WebAuthn-ready shape).
 * Uses biometrics as the user verification gate until native WebAuthn is integrated.
 */
export async function setPasskeyCredentialLocal(
  walletAddress: string,
  credentialId: string
): Promise<PasskeyCredentialRecord> {
  const record: PasskeyCredentialRecord = {
    credentialId,
    walletAddress,
    createdAt: new Date().toISOString(),
  };
  const payload = JSON.stringify(record);
  if (useDevSimulatorInsecureStore) {
    await AsyncStorage.setItem(DEV_SIM_PASSKEY_KEY, payload);
  } else {
    await writeJson(PASSKEY_CREDENTIAL_KEY, payload);
  }
  return record;
}

export async function registerDevicePasskey(walletAddress: string): Promise<PasskeyCredentialRecord> {
  if (useDevSimulatorInsecureStore) {
    const credentialId = Crypto.randomUUID();
    return setPasskeyCredentialLocal(walletAddress, credentialId);
  }

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (hasHardware) {
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      throw new Error("Set up Face ID or fingerprint on this device first.");
    }
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: "Set up seedless unlock",
      cancelLabel: "Cancel",
    });
    if (!auth.success) {
      throw new Error("Seedless setup cancelled");
    }
  }

  const credentialId = Crypto.randomUUID();
  return setPasskeyCredentialLocal(walletAddress, credentialId);
}

/** Require biometric verification before MPC-sensitive actions. */
export async function assertDevicePasskey(walletAddress: string): Promise<void> {
  const cred = await getPasskeyCredential();
  if (!cred || cred.walletAddress !== walletAddress) {
    throw new Error("Seedless unlock is not set up for this wallet");
  }

  if (useDevSimulatorInsecureStore) {
    return;
  }

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return;

  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: "Confirm with Face ID or fingerprint",
    cancelLabel: "Cancel",
  });
  if (!auth.success) {
    throw new Error("Authentication cancelled");
  }
}

export async function deletePasskeyCredential(): Promise<void> {
  if (useDevSimulatorInsecureStore) {
    await AsyncStorage.removeItem(DEV_SIM_PASSKEY_KEY);
  }
  try {
    await SecureStore.deleteItemAsync(PASSKEY_CREDENTIAL_KEY);
  } catch {
    // ignore
  }
}
