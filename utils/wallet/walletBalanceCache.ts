import type { userWalletType } from "@/utils/store/userstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import setUserItems from "@/utils/dashboard";

/** Show cached balances without refetching while younger than this */
export const WALLET_BALANCE_TTL_MS = 45_000;

/** Background poll interval while dashboard is open (only fetches when cache is stale) */
export const WALLET_POLL_INTERVAL_MS = 30_000;

export function isWalletBalanceCacheFresh(
  lastSyncedAt: number | null | undefined
): boolean {
  if (lastSyncedAt == null || !Number.isFinite(lastSyncedAt)) return false;
  return Date.now() - lastSyncedAt < WALLET_BALANCE_TTL_MS;
}

export function hasCachedWalletBalances(userWallet: userWalletType): boolean {
  return (
    userWallet.tokenAccounts.length > 0 ||
    userWallet.solBalance > 0 ||
    userWallet.totalUsdBalance > 0
  );
}

export function invalidateWalletBalanceCache(): void {
  UserItem.getState().setWalletLastSyncedAt(null);
}

export async function refreshUserWalletBalances(options?: {
  force?: boolean;
}): Promise<boolean> {
  const { force = false } = options ?? {};
  const { user, walletLastSyncedAt, updateUserWallet } = UserItem.getState();
  const { publicKey } = WalletItem.getState();
  const { network } = AppSettings.getState();

  if (!user || !publicKey) return false;

  if (!force && isWalletBalanceCacheFresh(walletLastSyncedAt)) {
    return true;
  }

  const ok = await setUserItems(user, updateUserWallet, publicKey, network);
  if (ok) {
    UserItem.getState().setWalletLastSyncedAt(Date.now());
  }
  return ok;
}
