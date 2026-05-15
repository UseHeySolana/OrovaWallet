import { Keypair, PublicKey } from "@solana/web3.js";
import WalletItem from "@/utils/store/wallet.store";
import { getWalletSecret } from "@/utils/storage/secureStore";
import { getKeypairFromMnemonic } from "@/utils/wallet";
import { hasMpcShareA } from "@/utils/storage/mpcShareStore";
import { getEphemeralMpcKeypair } from "@/utils/wallet/mpc/combineSign";
import type { WalletSigner } from "@/utils/wallet/signers/types";

/**
 * MPC wallet signer: combines Share A + Share B after passkey session.
 * Falls back to local mnemonic only for upgraded users who still have a phrase on device.
 */
export class MpcWalletSigner implements WalletSigner {
  readonly mode = "mpc" as const;

  getPublicKey(): PublicKey {
    const pk = WalletItem.getState().publicKey;
    if (!pk) {
      throw new Error("MPC wallet not initialized");
    }
    return pk;
  }

  async getKeypair(): Promise<Keypair | null> {
    const inMemory = WalletItem.getState().keypair;
    if (inMemory) return inMemory;

    const walletAddress = WalletItem.getState().publicKeyBase58;
    if (!walletAddress) return null;

    const hasShare = await hasMpcShareA();
    if (!hasShare) {
      const secret = await getWalletSecret();
      if (secret) {
        const keypair = await getKeypairFromMnemonic(secret);
        WalletItem.getState().updateKeypair(keypair);
        return keypair;
      }
      throw new Error(
        "Seedless device share missing. Re-enable seedless wallet in Settings → Security."
      );
    }

    try {
      const keypair = await getEphemeralMpcKeypair(walletAddress);
      WalletItem.getState().updateKeypair(keypair);
      return keypair;
    } catch (e) {
      const secret = await getWalletSecret();
      if (secret) {
        const keypair = await getKeypairFromMnemonic(secret);
        WalletItem.getState().updateKeypair(keypair);
        return keypair;
      }
      throw e;
    }
  }
}
