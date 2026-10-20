import { saveWalletAddress } from "@/utils/request/db";
import { setWalletSecret } from "@/utils/storage/secureStore";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import { generateMnemonic, getKeypairFromMnemonic } from "@/utils/wallet";
import { initWallet } from "@/utils/wallet/initWallet";

export type CreateWalletResult =
  | { success: true; walletAddress: string }
  | { success: false; message: string };

export async function createWalletForUser(
  username: string
): Promise<CreateWalletResult> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    return { success: false, message: "Username is required" };
  }

  const phrase = await generateMnemonic();
  if (!phrase) {
    return { success: false, message: "Could not generate wallet" };
  }

  try {
    const keypair = await getKeypairFromMnemonic(phrase);
    await setWalletSecret(phrase);
    WalletItem.getState().updateKeypair(keypair);
    WalletItem.getState().updatePassphrase(phrase);
    await initWallet();

    const walletAddress = keypair.publicKey.toBase58();
    const response = await saveWalletAddress(walletAddress, trimmedUsername);
    if (response.status === false) {
      return {
        success: false,
        message: response.message || "Could not save wallet to your account",
      };
    }

    const user = UserItem.getState().user;
    if (user) {
      UserItem.getState().setUser({
        ...user,
        wallet_address: walletAddress,
      });
    }

    AppSettings.getState().setPromptWalletBackup(true);

    // Sync into multiwallet user_wallets catalog (best-effort).
    try {
      const { createUserWallet } = await import("@/utils/wallet/accountsApi");
      await createUserWallet({
        username: trimmedUsername,
        wallet_type_slug: "solana",
      });
    } catch {
      // Catalog may not be migrated yet; Solana addressbook path still works.
    }

    return { success: true, walletAddress };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create wallet";
    return { success: false, message };
  }
}
