import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";

/** Best available wallet address for backend APIs (hydration-safe). */
export function resolveWalletAddress(): string {
  const { publicKey, publicKeyBase58 } = WalletItem.getState();
  const { user } = UserItem.getState();
  return (
    publicKey?.toBase58() ||
    publicKeyBase58 ||
    user?.wallet_address ||
    ""
  );
}
