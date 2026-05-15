import { uploadShareAPrfBackup, type ShareAPrfBackupResult } from "@/utils/passkey/shareAPrfBackup";

export type BackupSeedlessDeviceShareResult = ShareAPrfBackupResult;

/** Encrypt Share A with passkey PRF and upload to server (for reinstall on same Apple/Google account). */
export async function backupSeedlessDeviceShare(params: {
  walletAddress: string;
  username: string;
}): Promise<BackupSeedlessDeviceShareResult> {
  return uploadShareAPrfBackup(params);
}
