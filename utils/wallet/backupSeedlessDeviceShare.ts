import { getMpcShareA, hasMpcShareA } from "@/utils/storage/mpcShareStore";
import { authenticateWithPasskey } from "@/utils/passkey/webAuthnClient";
import { setStoredMpcSession } from "@/utils/passkey/mpcSessionStorage";
import { backupMpcShareA } from "@/utils/request/mpcWallet";
import AppSettings from "@/utils/store/settingsstore.store";

export interface BackupSeedlessDeviceShareResult {
  ok: boolean;
  message: string;
}

/**
 * Upload device Share A so the wallet can be restored on a new device after login.
 */
export async function backupSeedlessDeviceShare(params: {
  walletAddress: string;
  username: string;
}): Promise<BackupSeedlessDeviceShareResult> {
  const { walletAddress, username } = params;

  if (AppSettings.getState().walletMode !== "mpc") {
    return { ok: false, message: "Enable seedless wallet first." };
  }

  if (!(await hasMpcShareA())) {
    return {
      ok: false,
      message:
        "Device share not found on this phone. Restore from a device that still has your wallet, or use your recovery phrase.",
    };
  }

  const shareABase64 = await getMpcShareA();
  if (!shareABase64) {
    return { ok: false, message: "Could not read device share." };
  }

  try {
    const { mpcSessionToken } = await authenticateWithPasskey(walletAddress, username);
    await setStoredMpcSession(mpcSessionToken);

    const res = await backupMpcShareA(shareABase64, mpcSessionToken);
    if (!res.status) {
      return { ok: false, message: res.message };
    }

    return {
      ok: true,
      message: "Device share backed up. You can restore this wallet on a new phone after login.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backup failed";
    if (msg.includes("cancelled")) {
      return { ok: false, message: "Authentication cancelled" };
    }
    return { ok: false, message: msg };
  }
}
