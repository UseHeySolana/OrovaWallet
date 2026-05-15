import { Keypair, PublicKey } from "@solana/web3.js";
import WalletItem from "@/utils/store/wallet.store";
import { getKeypairFromMnemonic } from "@/utils/wallet";
import { getWalletSecret } from "@/utils/storage/secureStore";
import type { WalletSigner } from "@/utils/wallet/signers/types";

export class LocalMnemonicSigner implements WalletSigner {
  readonly mode = "local" as const;

  getPublicKey(): PublicKey {
    const pk = WalletItem.getState().publicKey;
    if (!pk) {
      throw new Error("Wallet not initialized");
    }
    return pk;
  }

  async getKeypair(): Promise<Keypair | null> {
    const inMemory = WalletItem.getState().keypair;
    if (inMemory) {
      return inMemory;
    }
    const secret = await getWalletSecret();
    if (!secret) return null;
    const keypair = await getKeypairFromMnemonic(secret);
    WalletItem.getState().updateKeypair(keypair);
    return keypair;
  }
}
