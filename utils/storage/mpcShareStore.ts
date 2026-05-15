import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";

const MPC_SHARE_A_KEY = "mpcShareA_v1";
const DEV_SIM_MPC_SHARE_A_KEY = "mpcShareA_dev_sim_v1";

const useDevSimulatorInsecureStore =
  typeof __DEV__ !== "undefined" && __DEV__ && !Device.isDevice;

export async function setMpcShareA(shareABase64: string): Promise<void> {
  if (useDevSimulatorInsecureStore) {
    await AsyncStorage.setItem(DEV_SIM_MPC_SHARE_A_KEY, shareABase64);
    return;
  }
  await SecureStore.setItemAsync(MPC_SHARE_A_KEY, shareABase64, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getMpcShareA(): Promise<string | null> {
  if (useDevSimulatorInsecureStore) {
    const dev = await AsyncStorage.getItem(DEV_SIM_MPC_SHARE_A_KEY);
    if (dev) return dev;
    return SecureStore.getItemAsync(MPC_SHARE_A_KEY);
  }
  return SecureStore.getItemAsync(MPC_SHARE_A_KEY);
}

export async function deleteMpcShareA(): Promise<void> {
  if (useDevSimulatorInsecureStore) {
    await AsyncStorage.removeItem(DEV_SIM_MPC_SHARE_A_KEY);
  }
  try {
    await SecureStore.deleteItemAsync(MPC_SHARE_A_KEY);
  } catch {
    // not written
  }
}

export async function hasMpcShareA(): Promise<boolean> {
  const v = await getMpcShareA();
  return Boolean(v && v.length > 0);
}
