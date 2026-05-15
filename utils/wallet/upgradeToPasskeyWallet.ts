import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import { deleteWalletSecret, getWalletSecret } from "@/utils/storage/secureStore";
import { setMpcShareA } from "@/utils/storage/mpcShareStore";
import {
  splitKeypairForMpcImport,
  encodeShareBase64,
  signOwnershipMessage,
} from "@/utils/wallet/mpc/keyImport";
import {
  fetchMpcUpgradeChallenge,
  completeMpcUpgrade,
} from "@/utils/request/mpcWallet";
import { saveWalletAddress } from "@/utils/request/db";
import UserItem from "@/utils/store/userstore.store";
import { getWalletSigner, invalidateWalletSignerCache } from "@/utils/wallet/signerManager";
import { getPasskeyCredential, setPasskeyCredentialLocal } from "@/utils/storage/passkeyStore";
import { registerSeedlessAuth } from "@/utils/passkey/registerSeedlessAuth";
import { clearMpcSession } from "@/utils/passkey/mpcSessionStorage";

export interface UpgradeSeedlessWalletResult {
  ok: boolean;
  message: string;
  walletAddress?: string;
}

/** @deprecated Use upgradeToSeedlessWallet */
export const upgradeToPasskeyWallet = upgradeToSeedlessWallet;

/**
 * User-driven upgrade: prove ownership, split key (same address), store shares, enable seedless mode.
 */
export async function upgradeToSeedlessWallet(params: {
  username: string;
  walletAddress?: string;
}): Promise<UpgradeSeedlessWalletResult> {
  const { username } = params;

  const signer = await getWalletSigner();
  const keypair = await signer.getKeypair();
  if (!keypair) {
    return { ok: false, message: "Wallet is not unlocked. Open the app and try again." };
  }

  const walletAddress = keypair.publicKey.toBase58();
  const user = UserItem.getState().user;

  const linked = await saveWalletAddress(walletAddress, username);
  if (linked.status === false) {
    return {
      ok: false,
      message:
        linked.message ||
        "Could not link this wallet to your account. Check your username in Profile.",
    };
  }
  if (user) {
    UserItem.getState().setUser({ ...user, wallet_address: walletAddress });
  }

  const challengeRes = await fetchMpcUpgradeChallenge(walletAddress, username);
  if (!challengeRes.status) {
    return {
      ok: false,
      message: challengeRes.message || "Could not reach server. Check your connection.",
    };
  }
  const { challenge } = challengeRes.data;

  const signature = signOwnershipMessage(keypair, challenge);

  const split = splitKeypairForMpcImport(keypair);
  if (split.walletAddress !== walletAddress) {
    return { ok: false, message: "Key import produced an unexpected address." };
  }

  const shareABase64 = encodeShareBase64(split.shareA);
  const shareBEncryptedBase64 = encodeShareBase64(split.shareB);

  const completeRes = await completeMpcUpgrade({
    walletAddress,
    username,
    shareBEncryptedBase64,
    challenge,
    signature,
  });
  if (!completeRes.status) {
    return {
      ok: false,
      message: completeRes.message || "Upgrade failed on server. Run backend migrations.",
    };
  }

  await setMpcShareA(shareABase64);
  AppSettings.getState().setWalletMode("mpc");
  invalidateWalletSignerCache();

  let seedlessMessage = "Seedless wallet enabled. Your address is unchanged.";
  try {
    const existing = await getPasskeyCredential();
    if (!existing || existing.walletAddress !== walletAddress) {
      const { credentialId } = await registerSeedlessAuth(walletAddress, username);
      await setPasskeyCredentialLocal(walletAddress, credentialId);
    }
    await clearMpcSession();
  } catch (e) {
    seedlessMessage =
      "Wallet upgraded to seedless. Unlock with biometrics may need another try in Settings.";
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[SeedlessUpgrade] auth registration:", e);
    }
  }

  return {
    ok: true,
    message: seedlessMessage,
    walletAddress: completeRes.data.wallet_address ?? walletAddress,
  };
}

export async function removeMnemonicAfterSeedlessUpgrade(params: {
  username: string;
  walletAddress: string;
}): Promise<{ ok: boolean; message: string }> {
  const mode = AppSettings.getState().walletMode;
  if (mode !== "mpc") {
    return { ok: false, message: "Enable seedless wallet first." };
  }

  const secret = await getWalletSecret();
  if (!secret) {
    return { ok: true, message: "Recovery phrase is already removed from this device." };
  }

  await deleteWalletSecret();
  WalletItem.getState().updatePassphrase(null);
  await clearMpcSession();
  invalidateWalletSignerCache();

  return {
    ok: true,
    message:
      "Recovery phrase removed from this device. Use seedless unlock to sign transactions.",
  };
}

/** @deprecated */
export const removeMnemonicAfterPasskeyUpgrade = removeMnemonicAfterSeedlessUpgrade;

export async function canOfferSeedlessUpgrade(): Promise<boolean> {
  const mode = AppSettings.getState().walletMode;
  if (mode === "mpc") return false;
  const secret = await getWalletSecret();
  return Boolean(secret && WalletItem.getState().publicKey);
}

/** @deprecated */
export const canOfferPasskeyUpgrade = canOfferSeedlessUpgrade;
