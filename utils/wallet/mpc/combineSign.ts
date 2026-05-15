/**
 * Client-side MPC signing: fetch Share B after passkey session, combine with Share A
 * in memory, sign, then discard the combined scalar.
 */
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getMpcShareA } from "@/utils/storage/mpcShareStore";
import { combineSharesToKeypair, decodeShareBase64 } from "@/utils/wallet/mpc/keyImport";
import { fetchMpcShareB } from "@/utils/request/mpcWallet";
import { ensureMpcSession } from "@/utils/passkey/mpcSession";

/** Ephemeral keypair from MPC shares (passkey session required). */
export async function getEphemeralMpcKeypair(
  walletAddress: string
): Promise<Keypair> {
  const shareAB64 = await getMpcShareA();
  if (!shareAB64) {
    throw new Error("MPC device share not found");
  }

  const session = await ensureMpcSession(walletAddress);
  const shareRes = await fetchMpcShareB(walletAddress, session);
  if (!shareRes.status) {
    throw new Error(shareRes.message);
  }

  return combineSharesToKeypair(
    decodeShareBase64(shareAB64),
    decodeShareBase64(shareRes.data.share_b)
  );
}

export async function signTransactionWithMpcCombine(
  tx: Transaction | VersionedTransaction,
  walletAddress: string
): Promise<Transaction | VersionedTransaction> {
  const kp = await getEphemeralMpcKeypair(walletAddress);

  if (tx instanceof VersionedTransaction) {
    tx.sign([kp]);
    return tx;
  }

  tx.partialSign(kp);
  return tx;
}
