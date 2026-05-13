import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";

const WALLET_SECRET_KEY = "walletSecret_v1";
/** Dev simulator only — not used on physical devices or release builds. */
const DEV_SIM_WALLET_SECRET_KEY = "walletSecret_dev_sim_v1";

const useDevSimulatorInsecureStore =
  typeof __DEV__ !== "undefined" && __DEV__ && !Device.isDevice;

const LOG = "[WalletSecret]";

function describeSecret(secret: string) {
  const trimmed = secret.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return { wordCount, charCount: trimmed.length };
}

function devLog(message: string, extra?: Record<string, unknown>) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  if (extra) {
    console.log(LOG, message, extra);
  } else {
    console.log(LOG, message);
  }
}

export async function setWalletSecret(secret: string) {
  const meta = describeSecret(secret);
  const backend = useDevSimulatorInsecureStore
    ? "AsyncStorage(dev-simulator)"
    : "SecureStore(iOS Keychain / Android Keystore)";

  try {
    if (useDevSimulatorInsecureStore) {
      await AsyncStorage.setItem(DEV_SIM_WALLET_SECRET_KEY, secret);
      devLog("write OK", { backend, key: DEV_SIM_WALLET_SECRET_KEY, ...meta });
      return;
    }
    await SecureStore.setItemAsync(WALLET_SECRET_KEY, secret, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    devLog("write OK", { backend, key: WALLET_SECRET_KEY, ...meta });
  } catch (e) {
    devLog("write FAILED", { backend, ...meta, error: String(e) });
    throw e;
  }
}

export async function getWalletSecret() {
  const backendPrimary = useDevSimulatorInsecureStore
    ? "AsyncStorage(dev-simulator)"
    : "SecureStore(iOS Keychain / Android Keystore)";

  if (useDevSimulatorInsecureStore) {
    const dev = await AsyncStorage.getItem(DEV_SIM_WALLET_SECRET_KEY);
    if (dev) {
      devLog("read HIT", {
        source: DEV_SIM_WALLET_SECRET_KEY,
        backend: backendPrimary,
        ...describeSecret(dev),
      });
      return dev;
    }
    const secure = await SecureStore.getItemAsync(WALLET_SECRET_KEY);
    if (secure) {
      devLog("read HIT", {
        source: WALLET_SECRET_KEY,
        backend: "SecureStore(fallback)",
        ...describeSecret(secure),
      });
      return secure;
    }
    devLog("read MISS", { checked: [DEV_SIM_WALLET_SECRET_KEY, WALLET_SECRET_KEY] });
    return null;
  }

  const secure = await SecureStore.getItemAsync(WALLET_SECRET_KEY);
  if (secure) {
    devLog("read HIT", {
      source: WALLET_SECRET_KEY,
      backend: backendPrimary,
      ...describeSecret(secure),
    });
  } else {
    devLog("read MISS", { key: WALLET_SECRET_KEY, backend: backendPrimary });
  }
  return secure;
}

export async function deleteWalletSecret() {
  devLog("delete requested", {
    devSimStore: useDevSimulatorInsecureStore,
  });
  if (useDevSimulatorInsecureStore) {
    await AsyncStorage.removeItem(DEV_SIM_WALLET_SECRET_KEY);
  }
  try {
    await SecureStore.deleteItemAsync(WALLET_SECRET_KEY);
  } catch {
    // Item may never have been written on simulator.
  }
  devLog("delete done");
}

