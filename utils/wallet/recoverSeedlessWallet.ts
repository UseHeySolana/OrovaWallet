import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";
import { setMpcShareA, hasMpcShareA, deleteMpcShareA } from "@/utils/storage/mpcShareStore";
import { authenticateWithPasskey } from "@/utils/passkey/webAuthnClient";
import { setStoredMpcSession } from "@/utils/passkey/mpcSessionStorage";
import { fetchMpcShareB } from "@/utils/request/mpcWallet";
import { fetchPasskeyAuthOptions } from "@/utils/request/passkey";
import { combineSharesToKeypair, decodeShareBase64 } from "@/utils/wallet/mpc/keyImport";
import { invalidateWalletSignerCache } from "@/utils/wallet/signerManager";
import { restoreShareAFromPrfBackup } from "@/utils/passkey/shareAPrfBackup";

export interface RecoverSeedlessWalletResult {
  ok: boolean;
  message: string;
  walletAddress?: string;
  needsDeviceLink?: boolean;
}

/**
 * Restore seedless wallet: local Share A, or PRF backup (synced passkey), or device link.
 */
export async function recoverSeedlessWallet(params: {
  walletAddress: string;
  username: string;
}): Promise<RecoverSeedlessWalletResult> {
  const walletAddress = params.walletAddress?.trim();
  const username = params.username?.trim();

  if (!walletAddress) {
    return { ok: false, message: "No wallet linked to this account." };
  }

  const serverPasskey = await fetchPasskeyAuthOptions(walletAddress);
  if (!serverPasskey.status) {
    return {
      ok: false,
      needsDeviceLink: true,
      message:
        "No passkey on this device yet. Use Link from primary phone or sign in with your synced passkey after OTP.",
    };
  }

  let shareAB64: string | null = null;
  let mpcSessionToken: string | null = null;

  if (await hasMpcShareA()) {
    shareAB64 = await import("@/utils/storage/mpcShareStore").then((m) => m.getMpcShareA());
  }

  if (!shareAB64) {
    const prfRestore = await restoreShareAFromPrfBackup({ walletAddress, username });
    if (!prfRestore.ok) {
      return {
        ok: false,
        needsDeviceLink: true,
        message: prfRestore.message,
      };
    }
    shareAB64 = prfRestore.shareABase64 ?? null;
    mpcSessionToken = prfRestore.mpcSessionToken ?? null;
  }

  if (!shareAB64) {
    return {
      ok: false,
      needsDeviceLink: true,
      message: "Device share missing. Link from your primary phone or use recovery phrase.",
    };
  }

  try {
    if (!mpcSessionToken) {
      const auth = await authenticateWithPasskey(walletAddress, username);
      mpcSessionToken = auth.mpcSessionToken;
    }
    await setStoredMpcSession(mpcSessionToken);

    const shareBRes = await fetchMpcShareB(walletAddress, mpcSessionToken);
    if (!shareBRes.status) {
      return { ok: false, message: shareBRes.message };
    }

    const keypair = combineSharesToKeypair(
      decodeShareBase64(shareAB64),
      decodeShareBase64(shareBRes.data.share_b)
    );
    if (keypair.publicKey.toBase58() !== walletAddress) {
      await deleteMpcShareA();
      return {
        ok: false,
        needsDeviceLink: true,
        message:
          "Restored device share does not match this wallet. Link from your primary phone instead.",
      };
    }

    AppSettings.getState().setWalletMode("mpc");
    WalletItem.getState().updateKeypair(keypair);
    WalletItem.getState().updatePassphrase(null);
    invalidateWalletSignerCache();

    const user = UserItem.getState().user;
    if (user) {
      UserItem.getState().setUser({ ...user, wallet_address: walletAddress, wallet_type: "mpc" });
    }

    return { ok: true, message: "Wallet unlocked", walletAddress };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not restore seedless wallet";
    if (msg.includes("cancelled")) {
      return { ok: false, message: "Authentication cancelled" };
    }
    return { ok: false, needsDeviceLink: true, message: msg };
  }
}
