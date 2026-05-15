import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";
import { setMpcShareA, hasMpcShareA, deleteMpcShareA } from "@/utils/storage/mpcShareStore";
import { authenticateWithPasskey, registerWebAuthnPasskey } from "@/utils/passkey/webAuthnClient";
import { setStoredMpcSession } from "@/utils/passkey/mpcSessionStorage";
import { fetchMpcShareB } from "@/utils/request/mpcWallet";
import { fetchPasskeyAuthOptions } from "@/utils/request/passkey";
import { combineSharesToKeypair, decodeShareBase64 } from "@/utils/wallet/mpc/keyImport";
import { invalidateWalletSignerCache } from "@/utils/wallet/signerManager";
import { setPasskeyCredentialLocal } from "@/utils/storage/passkeyStore";

export interface RecoverSeedlessWalletResult {
  ok: boolean;
  message: string;
  walletAddress?: string;
  needsDeviceLink?: boolean;
}

/**
 * Restore on this device using synced passkey (iCloud Keychain / Google).
 * Device Share A is never loaded from the server — use link flow for a new phone.
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
        "No passkey on this device yet. Use Link from primary phone — your device key never lives on our servers.",
    };
  }

  if (!(await hasMpcShareA())) {
    return {
      ok: false,
      needsDeviceLink: true,
      message:
        "Device share is not on this phone. Link from your primary device (Settings → Approve new device on that phone).",
    };
  }

  try {
    const { mpcSessionToken } = await authenticateWithPasskey(walletAddress, username);
    await setStoredMpcSession(mpcSessionToken);

    const shareAB64 = await import("@/utils/storage/mpcShareStore").then((m) => m.getMpcShareA());
    if (!shareAB64) {
      return { ok: false, needsDeviceLink: true, message: "Device share missing on this phone." };
    }

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
          "This phone has a device share from another wallet. Link from your primary phone instead.",
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

    try {
      const { credentialId } = await registerWebAuthnPasskey(walletAddress, username);
      await setPasskeyCredentialLocal(walletAddress, credentialId);
    } catch {
      // passkey may already exist on this device
    }

    return { ok: true, message: "Seedless wallet restored", walletAddress };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not restore seedless wallet";
    if (msg.includes("cancelled")) {
      return { ok: false, message: "Authentication cancelled" };
    }
    return { ok: false, needsDeviceLink: true, message: msg };
  }
}
