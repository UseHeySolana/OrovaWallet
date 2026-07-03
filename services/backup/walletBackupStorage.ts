import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@heysolana/google_drive_backup_meta";

export type WalletBackupMeta = {
  googleEmail: string;
  walletAddress: string;
  username: string;
  lastBackupAt: string;
  driveFileId?: string;
};

export async function getWalletBackupMeta(): Promise<WalletBackupMeta | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WalletBackupMeta;
  } catch {
    return null;
  }
}

export async function setWalletBackupMeta(meta: WalletBackupMeta): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

export async function clearWalletBackupMeta(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function hasCurrentWalletDriveBackup(
  walletAddress?: string
): Promise<boolean> {
  if (!walletAddress) return false;
  const meta = await getWalletBackupMeta();
  return meta?.walletAddress === walletAddress;
}
