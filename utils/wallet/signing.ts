import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import { api_key } from "@/utils/dashboard";
import { confirm } from "@/services/confirmation";

/** Resolve the unlocked wallet keypair for signing. */
export const keypairSign = async (): Promise<Keypair | null> => {
  const keypair = WalletItem.getState().keypair;
  if (!keypair) {
    return null;
  }
  const secretKeyArray = Object.values(keypair["_keypair"].secretKey);
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
};

/**
 * Sign (and optionally confirm + broadcast) a base64-encoded transaction.
 * Prefer skipConfirm=false for any money-moving path.
 */
export const signTransactions = async ({
  tx,
  feeAmount,
  type,
  connection: providedConnection,
  confirmMessage,
  skipConfirm,
}: {
  tx: string;
  feeAmount?: number;
  type?: string;
  /** Optional override RPC connection. Defaults to the configured base network. */
  connection?: Connection;
  /** Optional override prompt shown to the user before sending. */
  confirmMessage?: string;
  /** Skip the confirmation prompt. Default false. */
  skipConfirm?: boolean;
}) => {
  const network = AppSettings.getState().network;
  const connection = providedConnection ?? new Connection(`${network}${api_key}`);

  const keyPair = await keypairSign();
  if (!keyPair || !connection) {
    return {
      status: false,
      message: "Keypair not initialized or connection failed!",
    };
  }

  const txBuffer = Buffer.from(tx, "base64");

  let transaction: Transaction | VersionedTransaction;

  if (type === "versioned") {
    transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([keyPair]);
  } else {
    transaction = Transaction.from(txBuffer);
    const feeHolder =
      process.env.EXPO_FEE_HOLDER ||
      "13dqNw1su2UTYPVvqP6ahV8oHtghvoe2k2czkrx9uWJZ";
    if (feeAmount) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: keyPair.publicKey,
          toPubkey: new PublicKey(feeHolder),
          lamports: feeAmount,
        })
      );
    }

    transaction.partialSign(keyPair);
  }

  try {
    if (!skipConfirm) {
      const response = await confirm({
        message:
          confirmMessage ?? "Are you sure you want to send this transaction?",
        type: AppSettings.getState().openWithAuth ? "fingerprint" : undefined,
      });

      if (!response) {
        return { status: false, message: "You cancelled the transaction" };
      }
    }

    const txid = await connection.sendRawTransaction(transaction.serialize());
    return { status: true, message: txid };
  } catch (error) {
    return {
      status: false,
      message: `Signing failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

/** Sign a base64 versioned transaction from Jupiter (or similar); does not broadcast. */
export const signVersionedTxFromBase64 = async (
  txBase64: string
): Promise<
  { status: true; signedBase64: string } | { status: false; message: string }
> => {
  const keyPair = await keypairSign();
  if (!keyPair) {
    return { status: false, message: "Keypair not initialized!" };
  }
  try {
    const txBuffer = Buffer.from(txBase64, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([keyPair]);
    const signedBase64 = Buffer.from(transaction.serialize()).toString("base64");
    return { status: true, signedBase64 };
  } catch (error) {
    return {
      status: false,
      message: `Signing failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
