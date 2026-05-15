import { GoogleGenerativeAI } from "@google/generative-ai";
import AppSettings from "@/utils/store/settingsstore.store";
import { cache } from "@/utils/storage/cache";
import { getTransactionHistory } from "../request/db";
import WalletItem from "@/utils/store/wallet.store";
import { Connection, Keypair, SystemProgram, Transaction, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { api_key } from "@/utils/dashboard";
import { Linking } from "react-native";
import { confirm } from "@/services/confirmation";
import OpenAI from "openai";

const cleanNumber = (input: any) => {
  // Remove non-digit characters
  let cleaned = input.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
};

const showToast = (message: string) => {
  AppSettings.getState().setToast(message, "info");
};

const generate = async (instructions: string) => {
  const client = new OpenAI({
    apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || "",
  });

  const response = await client.responses.create({
    model: "gpt-4.1",
    input: instructions,
  });

  return response.output_text;
};

const convertSpeech = async (sentence: any) => {
  const result = await generate(
    `"${sentence} "Can you rewrite this sentence in a more conversational tone, I want to use it for a text to speech api, make it friendly
        
        Don't return any extra text just the re construct the sentence in a more conversational tone.
        `
  );
  return result;
};

const summarizeProduct = async (sentence: any) => {
  const result = await generate(
    `"${sentence} "Can you summarize this product in a single sentence. like give a short summary of the product if it is a great product or not, and if its a good fit for what the user is looking for , highlight the features of the product, refrence the ratings and comments on the product to help your feedback.
        `
  );
  return result;
};

const summarizeConversation = async (sentence: any) => {
  const result = await generate(
    `"${sentence} "Can you summarize this conversation in a single sentence. just what happend keep it very short and coincise 100 characters max eg. Airtime Purchase, amount and recipient, give similar examples for other actions, if failed, just use e.g Failed Airtime purchase.
        `
  );
  return result;
};

export type SolanaHistoryCluster = "devnet" | "mainnet";

const getTxHistoryCacheKeyForCluster = (
  publicKey: string,
  cluster: SolanaHistoryCluster
) => `txHistory:${cluster}:${publicKey}`;

/** Cache key for the wallet's current app network (mainnet vs devnet). */
const getTxHistoryCacheKey = (publicKey: string) =>
  getTxHistoryCacheKeyForCluster(
    publicKey,
    AppSettings.getState().networkShort === "devnet" ? "devnet" : "mainnet"
  );

function filterTransactionsForMint(
  transactions: any[],
  mintAddress: string
): any[] {
  return transactions.filter((tx: any) => {
    const mintInTokenTransfers = tx.tokenTransfers?.some(
      (t: any) => t.mint === mintAddress
    );
    const mintInAccountData = tx.accountData?.some((account: any) =>
      account.tokenBalanceChanges?.some((t: any) => t.mint === mintAddress)
    );
    const mintInSwapInputs = tx.events?.swap?.tokenInputs?.some(
      (t: any) => t.mint === mintAddress
    );
    const mintInSwapOutputs = tx.events?.swap?.tokenOutputs?.some(
      (t: any) => t.mint === mintAddress
    );
    const mintInInnerSwaps = tx.events?.swap?.innerSwaps?.some(
      (swap: any) =>
        swap.tokenInputs?.some((t: any) => t.mint === mintAddress) ||
        swap.tokenOutputs?.some((t: any) => t.mint === mintAddress) ||
        swap.tokenFees?.some((t: any) => t.mint === mintAddress)
    );
    const mintInNfts = tx.events?.nft?.nfts?.some(
      (nft: any) => nft.mint === mintAddress
    );

    return (
      mintInTokenTransfers ||
      mintInAccountData ||
      mintInSwapInputs ||
      mintInSwapOutputs ||
      mintInInnerSwaps ||
      mintInNfts
    );
  });
}

/** Wallet-wide Helius blob TTL (AsyncStorage). */
const WALLET_TX_HISTORY_TTL_MS = 5 * 60 * 1000;
/** Pre-filtered per-mint list TTL — faster repeat opens of the same token. */
const TOKEN_TX_SLICE_TTL_MS = 10 * 60 * 1000;

const tokenTxHistorySliceKey = (
  cluster: SolanaHistoryCluster,
  walletPk: string,
  mintAddress: string
) => `tokenTxHist:v1:${cluster}:${walletPk}:${mintAddress}`;

/** AsyncStorage key for the mint-filtered history slice (current app cluster). */
const getTokenTxHistorySliceCacheKey = (
  walletAddress: string,
  mintAddress: string
) => {
  const cluster: SolanaHistoryCluster =
    AppSettings.getState().networkShort === "devnet" ? "devnet" : "mainnet";
  return tokenTxHistorySliceKey(cluster, walletAddress, mintAddress);
};

/**
 * Instant paint from cache: mint slice first, else filter wallet blob.
 * `hit` is true when any usable cache entry existed (rows may be empty).
 */
const peekTokenTxHistoryFromCache = async (
  mintAddress: string,
  options?: { cluster?: SolanaHistoryCluster }
): Promise<{ hit: boolean; rows: any[] }> => {
  const publicKey = WalletItem.getState().publicKey;
  if (!publicKey) return { hit: false, rows: [] };

  const cluster: SolanaHistoryCluster =
    options?.cluster ??
    (AppSettings.getState().networkShort === "devnet" ? "devnet" : "mainnet");

  const sliceKey = tokenTxHistorySliceKey(
    cluster,
    publicKey.toString(),
    mintAddress
  );
  const sliceRaw = await cache.get(sliceKey);
  if (sliceRaw) {
    try {
      const rows = JSON.parse(sliceRaw);
      if (Array.isArray(rows)) return { hit: true, rows };
    } catch {
      await cache.remove(sliceKey);
    }
  }

  const walletKey = getTxHistoryCacheKeyForCluster(
    publicKey.toString(),
    cluster
  );
  const blob = await cache.get(walletKey);
  if (!blob) return { hit: false, rows: [] };
  try {
    const parsed = JSON.parse(blob);
    const raw = Array.isArray(parsed?.data) ? parsed.data : [];
    return { hit: true, rows: filterTransactionsForMint(raw, mintAddress) };
  } catch {
    return { hit: false, rows: [] };
  }
};

/** Per-token history for one cluster (Helius enhanced + client-side mint filter). */
const getTokenTransactions = async (
  mintAddress: string,
  options?: { cluster?: SolanaHistoryCluster }
) => {
  const response: {
    status: boolean;
    data: any[] | null;
    message?: string;
  } = { status: false, data: null };

  const publicKey = WalletItem.getState().publicKey;
  if (!publicKey) {
    return response;
  }

  const cluster: SolanaHistoryCluster =
    options?.cluster ??
    (AppSettings.getState().networkShort === "devnet" ? "devnet" : "mainnet");

  const sliceKey = tokenTxHistorySliceKey(
    cluster,
    publicKey.toString(),
    mintAddress
  );
  const sliceRaw = await cache.get(sliceKey);
  if (sliceRaw) {
    try {
      const rows = JSON.parse(sliceRaw);
      if (Array.isArray(rows)) {
        response.status = true;
        response.data = rows;
        return response;
      }
    } catch {
      await cache.remove(sliceKey);
    }
  }

  const cacheKey = getTxHistoryCacheKeyForCluster(
    publicKey.toString(),
    cluster
  );
  const txHistory = await cache.get(cacheKey);
  if (!txHistory) {
    const fetchedTxHistory = await getTransactionHistory(
      publicKey.toString(),
      cluster
    );
    if (!fetchedTxHistory.status || fetchedTxHistory.data == null) {
      response.message =
        typeof (fetchedTxHistory as { message?: string }).message === "string"
          ? (fetchedTxHistory as { message: string }).message
          : undefined;
      return response;
    }
    const raw = Array.isArray(fetchedTxHistory.data) ? fetchedTxHistory.data : [];
    await cache.set(
      cacheKey,
      JSON.stringify({ status: true, data: raw }),
      WALLET_TX_HISTORY_TTL_MS
    );

    response.status = true;
    response.data = filterTransactionsForMint(raw, mintAddress);
    await cache.set(
      sliceKey,
      JSON.stringify(response.data),
      TOKEN_TX_SLICE_TTL_MS
    );
    return response;
  }

  try {
    const parsedTx = JSON.parse(txHistory);
    const raw = Array.isArray(parsedTx?.data) ? parsedTx.data : [];
    response.status = true;
    response.data = filterTransactionsForMint(raw, mintAddress);
    await cache.set(
      sliceKey,
      JSON.stringify(response.data),
      TOKEN_TX_SLICE_TTL_MS
    );
    return response;
  } catch {
    await cache.remove(cacheKey);
    return response;
  }
};

const getWalletTransactions = async (options?: {
  invalidateCache?: boolean;
}) => {
  const response: {
    status: boolean;
    data: any[] | null;
    message?: string;
  } = { status: false, data: null };

  const publicKey = WalletItem.getState().publicKey;
  if (!publicKey) return response;

  const cacheKey = getTxHistoryCacheKey(publicKey.toString());
  if (options?.invalidateCache) {
    await cache.remove(cacheKey);
  }

  const rawCached = await cache.get(cacheKey);
  if (rawCached) {
    try {
      const parsed = JSON.parse(rawCached);
      if (parsed?.status && parsed.data != null) {
        const list = Array.isArray(parsed.data) ? parsed.data : [];
        response.status = true;
        response.data = list;
        return response;
      }
    } catch {
      await cache.remove(cacheKey);
    }
  }

  const fetched = await getTransactionHistory(publicKey.toString());
  if (!fetched.status || fetched.data == null) {
    response.message =
      typeof (fetched as { message?: string }).message === "string"
        ? (fetched as { message: string }).message
        : undefined;
    return response;
  }

  const list = Array.isArray(fetched.data) ? fetched.data : [];
  await cache.set(cacheKey, JSON.stringify({ status: true, data: list }), WALLET_TX_HISTORY_TTL_MS);
  response.status = true;
  response.data = list;
  return response;
};

type DateInput = number | string | Date;

interface FormatOptions {
  locale?: string;
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
}
function formatDate(input: DateInput, options: FormatOptions = {}): string {
  const {
    locale = "en-US",
    dateStyle = "medium",
    timeStyle = "short",
  } = options;

  let date: Date;

  if (typeof input === "number") {
    // Detect seconds vs milliseconds
    date = input < 1e12 ? new Date(input * 1000) : new Date(input);
  } else if (typeof input === "string") {
    date = new Date(input);
  } else if (input instanceof Date) {
    date = input;
  } else {
    throw new Error("Unsupported date format");
  }

  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle }).format(date);
}

const shortenPub = (pub: string) => {
  if (!pub) {
    return "N/A";
  }
  return pub.slice(0, 4) + "..." + pub.slice(-4);
};

const keypairSign = async () => {
  const { getWalletSigner } = await import("@/utils/wallet/signerManager");
  const signer = await getWalletSigner();
  const keypair = await signer.getKeypair();
  if (keypair) return keypair;

  const inMemory = WalletItem.getState().keypair;
  if (!inMemory) return null;
  const secretKeyArray = Object.values(inMemory["_keypair"].secretKey);
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
};

const signTransactions = async ({
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

  const { getWalletMode } = await import("@/utils/wallet/signerManager");
  const { signTransactionWithMpcCombine } = await import("@/utils/wallet/mpc/combineSign");
  const mode = await getWalletMode();
  const walletAddress = keyPair.publicKey.toBase58();

  if (type === "versioned") {
    transaction = VersionedTransaction.deserialize(txBuffer);
    if (mode === "mpc") {
      transaction = (await signTransactionWithMpcCombine(
        transaction,
        walletAddress
      )) as VersionedTransaction;
    } else {
      transaction.sign([keyPair]);
    }
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

    if (mode === "mpc") {
      transaction = (await signTransactionWithMpcCombine(
        transaction,
        walletAddress
      )) as Transaction;
    } else {
      transaction.partialSign(keyPair);
    }
  }

  try {
    if (!skipConfirm) {
      const response = await confirm({
        message: confirmMessage ?? "Are you sure you want to send this transaction?",
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
const signVersionedTxFromBase64 = async (
  txBase64: string
): Promise<{ status: true; signedBase64: string } | { status: false; message: string }> => {
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

const openURL = async (url: string) => {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  } else {
    console.warn(`Don't know how to open URI: ${url}`);
  }
};
export {
  showToast,
  cleanNumber,
  convertSpeech,
  summarizeConversation,
  getTxHistoryCacheKey,
  getTxHistoryCacheKeyForCluster,
  getTokenTxHistorySliceCacheKey,
  peekTokenTxHistoryFromCache,
  getWalletTransactions,
  getTokenTransactions,
  formatDate,
  shortenPub,
  keypairSign,
  signTransactions,
  signVersionedTxFromBase64,
  openURL,
  summarizeProduct,
};
