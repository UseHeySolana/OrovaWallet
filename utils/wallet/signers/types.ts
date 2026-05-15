import { Keypair, PublicKey } from "@solana/web3.js";
import type { WalletMode } from "@/utils/wallet/types";

export interface WalletSigner {
  readonly mode: WalletMode;
  getPublicKey(): PublicKey;
  /** Full keypair — available for `local` mode and MPC transition while mnemonic remains. */
  getKeypair(): Promise<Keypair | null>;
}
