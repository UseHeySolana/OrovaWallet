import WalletItem from "@/utils/store/wallet.store";
import { getKeypairFromMnemonic } from "@/utils/wallet";
import { getWalletSecret } from "@/utils/storage/secureStore";

/** True only when the mnemonic/private key is in secure storage and matches the account address. */
export async function isWalletUnlockedForUser(
  walletAddress?: string
): Promise<boolean> {
  if (!walletAddress?.trim()) return false;

  const secret = await getWalletSecret();
  if (!secret?.trim()) return false;

  try {
    const keypair = await getKeypairFromMnemonic(secret);
    return keypair.publicKey.toBase58() === walletAddress;
  } catch {
    return false;
  }
}

/** Load secret from secure storage into the in-memory wallet store. */
export async function hydrateWalletFromSecret(): Promise<boolean> {
  const secret = await getWalletSecret();
  if (!secret?.trim()) return false;

  try {
    const keypair = await getKeypairFromMnemonic(secret);
    WalletItem.getState().updateKeypair(keypair);
    WalletItem.getState().updatePassphrase(secret);
    return true;
  } catch {
    return false;
  }
}

/** Clear a persisted public key when the secret is missing (avoids false "wallet ready"). */
export function clearStaleWalletPublicKey(walletAddress?: string): void {
  const { publicKey } = WalletItem.getState();
  if (
    publicKey &&
    walletAddress &&
    publicKey.toString() === walletAddress
  ) {
    WalletItem.getState().updateKeypair(null);
    WalletItem.getState().updatePassphrase(null);
  }
}
