import AsyncStorage from "@react-native-async-storage/async-storage";
import WalletItem from "@/utils/store/wallet.store";
import { getKeypairFromMnemonic } from "@/utils/wallet";
import { getWalletSecret, setWalletSecret } from "@/utils/storage/secureStore";

type LegacyWalletPersist = {
  state?: {
    passphrase?: string | null;
  };
};

async function tryMigrateLegacyWalletSecretFromAsyncStorage() {
  const legacyRaw = await AsyncStorage.getItem("wallet");
  if (!legacyRaw) return;

  const existing = await getWalletSecret();
  if (existing) {
    await AsyncStorage.removeItem("wallet");
    return;
  }

  try {
    const parsed: LegacyWalletPersist = JSON.parse(legacyRaw);
    const legacySecret = parsed?.state?.passphrase;
    if (typeof legacySecret === "string" && legacySecret.trim().length > 0) {
      await setWalletSecret(legacySecret.trim());
    }
  } catch {
    // ignore
  } finally {
    await AsyncStorage.removeItem("wallet");
  }
}

async function hydrateWalletFromSecureStore() {
  const secret = await getWalletSecret();
  if (!secret) return false;

  const keypair = await getKeypairFromMnemonic(secret);
  WalletItem.getState().updatePassphrase(secret); // in-memory only
  WalletItem.getState().updateKeypair(keypair); // in-memory + persists public key only
  return true;
}

export async function initWallet() {
  await tryMigrateLegacyWalletSecretFromAsyncStorage();
  const hydrated = await hydrateWalletFromSecureStore();
  return { hydrated };
}

