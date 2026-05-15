import { getMpcShareA, hasMpcShareA, setMpcShareA } from "@/utils/storage/mpcShareStore";
import { authenticateWithPasskeyAndPrf } from "@/utils/passkey/webAuthnClient";
import { setStoredMpcSession } from "@/utils/passkey/mpcSessionStorage";
import {
  backupMpcShareAPrf,
  fetchMpcShareAPrfBackup,
} from "@/utils/request/mpcWallet";
import {
  decryptShareAWithPrfKey,
  encryptShareAWithPrfKey,
  isPrfEncryptedShareAPayload,
} from "@/utils/passkey/prfShareA";

export interface ShareAPrfBackupResult {
  ok: boolean;
  message: string;
}

/** Encrypt Share A with PRF key and upload (caller may supply key from registration). */
export async function uploadShareAPrfBackupWithKey(params: {
  walletAddress: string;
  username: string;
  prfKey: Uint8Array;
  mpcSessionToken: string;
}): Promise<ShareAPrfBackupResult> {
  const shareAB64 = await getMpcShareA();
  if (!shareAB64) {
    return { ok: false, message: "Device share not found on this phone." };
  }
  const encrypted = encryptShareAWithPrfKey(shareAB64, params.prfKey);
  const res = await backupMpcShareAPrf(
    encrypted,
    params.mpcSessionToken,
    params.walletAddress
  );
  if (!res.status) {
    return { ok: false, message: res.message };
  }
  return {
    ok: true,
    message: "Device share backed up with your passkey.",
  };
}

/** Encrypt Share A with passkey PRF and store ciphertext on server. */
export async function uploadShareAPrfBackup(params: {
  walletAddress: string;
  username: string;
}): Promise<ShareAPrfBackupResult> {
  if (!(await hasMpcShareA())) {
    return { ok: false, message: "Device share not found on this phone." };
  }

  try {
    const { mpcSessionToken, prfKey } = await authenticateWithPasskeyAndPrf(
      params.walletAddress,
      params.username
    );
    if (!prfKey) {
      return {
        ok: false,
        message:
          "Passkey PRF is not available on this device (requires iOS 18+). Try again after updating iOS, or use device link.",
      };
    }
    await setStoredMpcSession(mpcSessionToken);
    return uploadShareAPrfBackupWithKey({
      ...params,
      prfKey,
      mpcSessionToken,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backup failed";
    if (msg.includes("cancelled")) {
      return { ok: false, message: "Authentication cancelled" };
    }
    return { ok: false, message: msg };
  }
}

/** Download PRF-encrypted Share A and decrypt with passkey (reinstall / new device). */
export async function restoreShareAFromPrfBackup(params: {
  walletAddress: string;
  username: string;
}): Promise<ShareAPrfBackupResult & { shareABase64?: string; mpcSessionToken?: string }> {
  const { walletAddress, username } = params;

  try {
    const { mpcSessionToken, prfKey } = await authenticateWithPasskeyAndPrf(
      walletAddress,
      username
    );
    if (!prfKey) {
      return {
        ok: false,
        message: "Passkey PRF not available. Use device link or recovery phrase.",
      };
    }
    await setStoredMpcSession(mpcSessionToken);

    const blobRes = await fetchMpcShareAPrfBackup(walletAddress, mpcSessionToken);
    if (!blobRes.status) {
      return { ok: false, message: blobRes.message };
    }
    const payload = blobRes.data.share_a_prf_encrypted;
    if (!isPrfEncryptedShareAPayload(payload)) {
      return {
        ok: false,
        message: "No passkey backup for this wallet yet. Link from your primary phone.",
      };
    }

    const shareAB64 = decryptShareAWithPrfKey(payload, prfKey);
    await setMpcShareA(shareAB64);
    return {
      ok: true,
      message: "Device share restored from passkey backup",
      shareABase64,
      mpcSessionToken,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Restore failed";
    if (msg.includes("cancelled")) {
      return { ok: false, message: "Authentication cancelled" };
    }
    return { ok: false, message: msg };
  }
}
