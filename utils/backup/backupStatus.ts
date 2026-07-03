import type { UserType } from "@/utils/types/user.types";
import { hasCurrentWalletDriveBackup } from "@/services/backup/walletBackupStorage";
import { userHasMobileNumber } from "@/utils/account/userContact";
import { userMissingBackupEmail } from "@/utils/account/emailSetup";

export async function userNeedsDriveBackup(
  user: UserType | null | undefined
): Promise<boolean> {
  if (!user?.username) return false;
  if (!user.wallet_address?.trim()) return false;
  return !(await hasCurrentWalletDriveBackup(user.wallet_address));
}

/** Existing phone accounts without email + Drive backup — show import on login. */
export async function userNeedsLegacyWalletRestore(
  user: UserType | null | undefined
): Promise<boolean> {
  if (!user || !userHasMobileNumber(user)) return false;
  if (!user.wallet_address?.trim()) return false;
  if (userMissingBackupEmail(user)) return true;
  return userNeedsDriveBackup(user);
}

export function accountMissingServerWallet(walletAddress?: string | null): boolean {
  return !walletAddress?.trim();
}
