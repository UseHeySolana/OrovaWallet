import AppSettings from "@/utils/store/settingsstore.store";
import { cache } from "@/utils/storage/cache";
import { getTransactionHistory } from "../request/db";
import WalletItem from "@/utils/store/wallet.store";
import { Linking } from "react-native";
import {
  requestAiTextLine,
} from "@/services/aiTextApi";
import {
  keypairSign,
  signTransactions,
  signVersionedTxFromBase64,
} from "@/utils/wallet/signing";

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

const convertSpeech = async (sentence: any) => {
  const text = String(sentence ?? "");
  const result = await requestAiTextLine("convert_speech", text);
  return result || text;
};

const summarizeProduct = async (sentence: any) => {
  const text = String(sentence ?? "");
  const result = await requestAiTextLine("summarize_product", text);
  return result || text;
};

const summarizeConversation = async (sentence: any) => {
  const text = String(sentence ?? "");
  const result = await requestAiTextLine("summarize_conversation", text);
  return (result || text).replace(/\s+/g, " ").trim();
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
