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

const getTokenTransactions = async (mintAddress: string) => {
  const response = {
    status: false,
    data: null,
  };

  const publicKey = WalletItem.getState().publicKey;
  if (!publicKey) {
    response.status = false;
    return response;
  }

  const cacheKey = `txHistory:${publicKey.toString()}`;
  const txHistory = await cache.get(cacheKey);
  if (!txHistory) {
    const fetchedTxHistory = await getTransactionHistory(publicKey.toString());
    if (!fetchedTxHistory.status) {
      return response;
    }
    // Cache for 5 minutes
    await cache.set(cacheKey, JSON.stringify(fetchedTxHistory), 5 * 60 * 1000);

    const filtered = fetchedTxHistory.data.filter((tx: any) => {
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

    response.status = true;
    response.data = filtered;
    return response;
  }

  const parsedTx = JSON.parse(txHistory);
  const filtered = parsedTx.data.filter((tx: any) => {
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
  response.status = true;
  response.data = filtered;
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
  const keypair = WalletItem.getState().keypair;
  if (!keypair) {
    return null;
  }
  const secretKeyArray = Object.values(keypair["_keypair"].secretKey);
  const keypairNew = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

  return keypairNew;
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
  getTokenTransactions,
  formatDate,
  shortenPub,
  keypairSign,
  signTransactions,
  openURL,
  summarizeProduct,
};
