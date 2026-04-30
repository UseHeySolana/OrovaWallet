import * as SecureStore from "expo-secure-store";

const WALLET_SECRET_KEY = "walletSecret_v1";

export async function setWalletSecret(secret: string) {
  return SecureStore.setItemAsync(WALLET_SECRET_KEY, secret, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getWalletSecret() {
  return SecureStore.getItemAsync(WALLET_SECRET_KEY);
}

export async function deleteWalletSecret() {
  return SecureStore.deleteItemAsync(WALLET_SECRET_KEY);
}

