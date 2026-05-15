import AsyncStorage from "@react-native-async-storage/async-storage";
import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import { getKeypairFromMnemonic } from "@/utils/wallet";
import { getWalletSecret, setWalletSecret } from "@/utils/storage/secureStore";
import { hasMpcShareA } from "@/utils/storage/mpcShareStore";
import {
  invalidateWalletSignerCache,
  resolveWalletMode,
} from "@/utils/wallet/signerManager";
import { getWalletSigner } from "@/utils/wallet/signerManager";

type StoreWithPersist = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

/** Avoid reading / migrating `wallet` AsyncStorage before Zustand has rehydrated. */
async function waitForPersist(store: StoreWithPersist) {
  if (store.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = store.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

type LegacyWalletPersist = {
  state?: {
    passphrase?: string | null;
  };
};

function readLegacyPassphraseFromWalletStorage(raw: string): string | null {
  let parsed: LegacyWalletPersist;
  try {
    parsed = JSON.parse(raw) as LegacyWalletPersist;
  } catch {
    return null;
  }

  const passphrase = parsed?.state?.passphrase;
  if (typeof passphrase !== "string" || passphrase.trim().length === 0) {
    return null;
  }
  return passphrase.trim();
}

/**
 * Older builds stored the mnemonic in AsyncStorage under the same key as Zustand
 * (`wallet`). Current builds only persist `publicKeyBase58` there and keep the
 * mnemonic in SecureStore. Only strip/remove AsyncStorage when we detect a real
 * legacy passphrase blob — never delete the modern Zustand snapshot.
 */
async function tryMigrateLegacyWalletSecretFromAsyncStorage() {
  const legacyRaw = await AsyncStorage.getItem("wallet");
  if (!legacyRaw) return;

  const legacySecret = readLegacyPassphraseFromWalletStorage(legacyRaw);
  if (!legacySecret) {
    return;
  }

  const existing = await getWalletSecret();
  const hadSecretAlready = Boolean(existing);
  if (!existing) {
    await setWalletSecret(legacySecret);
  }

  await AsyncStorage.removeItem("wallet");
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log(
      "[WalletSecret]",
      hadSecretAlready
        ? "legacy AsyncStorage `wallet` cleared (mnemonic already in secure storage)"
        : "legacy mnemonic copied to secure storage; legacy `wallet` blob removed"
    );
  }
}

async function hydrateWalletFromSecureStore() {
  const mode = await resolveWalletMode();
  const hasShare = await hasMpcShareA();

  if (mode === "mpc") {
    if (hasShare) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.log(
          "[WalletSecret]",
          "hydrate mpc — share A present; unlock via seedless session"
        );
      }
      invalidateWalletSignerCache();
      try {
        const signer = await getWalletSigner();
        const kp = await signer.getKeypair();
        if (kp) {
          WalletItem.getState().updateKeypair(kp);
        }
      } catch (e) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[WalletSecret]", "mpc hydrate — open app to unlock seedless wallet", e);
        }
      }
    } else if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[WalletSecret]",
        "seedless mode but device share missing — re-run seedless upgrade on this device"
      );
    }
    return Boolean(WalletItem.getState().publicKey);
  }

  const secret = await getWalletSecret();
  if (!secret) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[WalletSecret]", "hydrate skipped — no secret in secure storage");
    }
    return false;
  }

  const keypair = await getKeypairFromMnemonic(secret);
  WalletItem.getState().updatePassphrase(secret);
  WalletItem.getState().updateKeypair(keypair);
  invalidateWalletSignerCache();
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const pk = keypair.publicKey.toBase58();
    console.log("[WalletSecret]", "hydrate OK — wallet unlocked", {
      mode,
      publicKeyPreview: `${pk.slice(0, 4)}…${pk.slice(-4)}`,
    });
  }
  return true;
}

export async function initWallet() {
  await Promise.all([
    waitForPersist(WalletItem as unknown as StoreWithPersist),
    waitForPersist(AppSettings as unknown as StoreWithPersist),
    waitForPersist(UserItem as unknown as StoreWithPersist),
  ]);
  await tryMigrateLegacyWalletSecretFromAsyncStorage();
  const hydrated = await hydrateWalletFromSecureStore();
  const mode = await resolveWalletMode();
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[WalletSecret]", "initWallet finished", { hydrated, mode });
  }
  return { hydrated, mode };
}
