import {
  decryptWalletSecret,
  encryptWalletSecret,
  WALLET_BACKUP_VERSION,
} from "@/services/backup/walletBackupCrypto";
import {
  downloadWalletBackupFromDrive,
  uploadWalletBackupToDrive,
} from "@/services/backup/googleDriveBackup";
import {
  getGoogleSignInErrorMessage,
  signInWithGoogleForBackup,
} from "@/services/google/googleAuth";
import { setWalletBackupMeta } from "@/services/backup/walletBackupStorage";
import { getWalletSecret, setWalletSecret } from "@/utils/storage/secureStore";
import { getKeypairFromMnemonic } from "@/utils/wallet";
import { hydrateWalletFromSecret } from "@/utils/wallet/walletUnlock";
import { logBackup, logBackupError, previewWallet } from "@/services/backup/backupLogger";

export type BackupWalletResult = {
  googleEmail: string;
  lastBackupAt: string;
};

export async function backupWalletToGoogleDrive(input: {
  pin: string;
  username: string;
  walletAddress: string;
}): Promise<BackupWalletResult> {
  logBackup("backup started", {
    username: input.username,
    wallet: previewWallet(input.walletAddress),
  });

  try {
    const secret = await getWalletSecret();
    if (!secret) {
      logBackupError("backup failed — no local wallet secret", null);
      throw new Error("No wallet secret found on this device");
    }
    logBackup("wallet secret loaded", {
      wordCount: secret.trim().split(/\s+/).filter(Boolean).length,
    });

    logBackup("google sign-in starting");
    const google = await signInWithGoogleForBackup();
    logBackup("google sign-in ok", {
      email: google.email || "(no email)",
      googleId: google.id ? `${google.id.slice(0, 6)}…` : "—",
      hasAccessToken: Boolean(google.accessToken),
    });

    logBackup("encrypting backup");
    const encrypted = await encryptWalletSecret(secret, input.pin);
    const backup = {
      version: WALLET_BACKUP_VERSION,
      username: input.username,
      walletAddress: input.walletAddress,
      createdAt: new Date().toISOString(),
      ...encrypted,
    };
    logBackup("backup encrypted");

    logBackup("uploading to drive");
    const uploaded = await uploadWalletBackupToDrive(google.accessToken, backup);
    const lastBackupAt = uploaded.modifiedTime ?? backup.createdAt;
    logBackup("upload complete", {
      fileId: uploaded.fileId,
      lastBackupAt,
    });

    await setWalletBackupMeta({
      googleEmail: google.email,
      walletAddress: input.walletAddress,
      username: input.username,
      lastBackupAt,
      driveFileId: uploaded.fileId,
    });
    logBackup("local backup meta saved");

    logBackup("backup finished", {
      email: google.email || "Google Drive",
      lastBackupAt,
    });

    return {
      googleEmail: google.email,
      lastBackupAt,
    };
  } catch (error) {
    logBackupError("backup failed", error, {
      username: input.username,
      wallet: previewWallet(input.walletAddress),
    });
    throw error;
  }
}

async function resolveGoogleDriveAccess(input?: {
  accessToken?: string;
}): Promise<{ accessToken: string; email: string }> {
  if (input?.accessToken) {
    return { accessToken: input.accessToken, email: "" };
  }
  const google = await signInWithGoogleForBackup();
  return { accessToken: google.accessToken, email: google.email };
}

export async function peekGoogleDriveWalletBackup(input?: {
  accessToken?: string;
}): Promise<{
  username: string;
  walletAddress: string;
} | null> {
  const google = await resolveGoogleDriveAccess(input);
  const backup = await downloadWalletBackupFromDrive(google.accessToken);
  if (!backup?.username || !backup.walletAddress) {
    return null;
  }
  return {
    username: backup.username,
    walletAddress: backup.walletAddress,
  };
}

export async function restoreWalletFromGoogleDrive(
  pin: string,
  input?: { accessToken?: string; googleEmail?: string }
): Promise<{
  walletAddress: string;
  username: string;
}> {
  logBackup("restore started");
  try {
    const google = await resolveGoogleDriveAccess(input);
    logBackup("restore — drive access ok", { email: google.email || "—" });

    const backup = await downloadWalletBackupFromDrive(google.accessToken);
    if (!backup) {
      logBackupError("restore failed — no backup file on drive", null);
      throw new Error("No wallet backup found in your Google Drive");
    }
    logBackup("restore — backup file downloaded", {
      username: backup.username,
      wallet: previewWallet(backup.walletAddress),
      createdAt: backup.createdAt,
    });

    const secret = await decryptWalletSecret(backup, pin);
    const keypair = await getKeypairFromMnemonic(secret);
    const walletAddress = keypair.publicKey.toBase58();
    logBackup("restore — decrypted", { wallet: previewWallet(walletAddress) });

    await setWalletSecret(secret);

    const stored = await getWalletSecret();
    if (!stored) {
      throw new Error("Wallet secret was not saved on this device");
    }

    const hydrated = await hydrateWalletFromSecret();
    if (!hydrated) {
      throw new Error("Could not unlock wallet after restore");
    }

    await setWalletBackupMeta({
      googleEmail: google.email || input?.googleEmail || "",
      walletAddress,
      username: backup.username,
      lastBackupAt: backup.createdAt,
    });

    logBackup("restore finished", { wallet: previewWallet(walletAddress) });
    return {
      walletAddress,
      username: backup.username,
    };
  } catch (error) {
    logBackupError("restore failed", error);
    throw error;
  }
}

export { getGoogleSignInErrorMessage };
