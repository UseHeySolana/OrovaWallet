import AppSettings from "@/utils/store/settingsstore.store";
import type { VoiceAssistantSession } from "@/libs/voiceinfra/types";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import { ParsedAccountData, PublicKey } from "@solana/web3.js";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import {
  completeConversation,
  resolveTokenByQuery,
} from "@/utils/functions";
import {
  transferSol,
  transferToken,
  getTokenBalance,
} from "@/libs/tools/transfer/transfers";
import ToolsItem from "@/utils/store/toolsitems.store";
import { pajcash, Chain, Currency } from "@/libs/tools/pajcash/pajcash";
import PajCashSession from "@/utils/store/pajcashSession.store";
import Convo from "@/utils/store/conversation.store";

const PAJ_APP = "Pajcash";
const PAJ_OFFRAMP = "offramp";
const PAJ_CREDENTIALS = "credentials";

const DEFAULT_USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

function defaultUsdcMint(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_PAJCASH_USDC_MINT || "").trim();
  if (fromEnv) return fromEnv;
  return AppSettings.getState().networkShort === "devnet"
    ? DEFAULT_USDC_DEVNET
    : DEFAULT_USDC_MAINNET;
}

function parseMintAddress(token: string): string | null {
  try {
    return new PublicKey(token.trim()).toBase58();
  } catch {
    return null;
  }
}

async function getMintDecimals(
  mint: string,
  connection?: VoiceAssistantSession["connection"]
): Promise<number> {
  if (!connection) return 6;
  try {
    const info = await connection.getParsedAccountInfo(new PublicKey(mint));
    const decimals = (info.value?.data as ParsedAccountData | undefined)?.parsed
      ?.info?.decimals;
    return typeof decimals === "number" ? decimals : 6;
  } catch {
    return 6;
  }
}

async function resolveMint(
  token: string,
  connection?: VoiceAssistantSession["connection"]
): Promise<{
  mint: string;
  decimals: number;
  symbol: string;
} | null> {
  const meta = await resolveTokenByQuery(token);
  if (!meta && token.toLowerCase() === "usdc") {
    return { mint: defaultUsdcMint(), decimals: 6, symbol: "USDC" };
  }
  if (meta && meta.symbol !== "SOL") {
    return {
      mint: meta.address,
      decimals: meta.decimals,
      symbol: meta.symbol || token,
    };
  }
  const mint = parseMintAddress(token);
  if (mint) {
    return {
      mint,
      decimals: await getMintDecimals(mint, connection),
      symbol: `${mint.slice(0, 4)}...${mint.slice(-4)}`,
    };
  }
  return null;
}

type TransferResult = { status: boolean; message: string };

async function sendTokens(
  token: string,
  amount: number,
  recipient: string,
  connection: VoiceAssistantSession["connection"]
): Promise<TransferResult> {
  if (token.toLowerCase() === "sol") {
    const result = await transferSol(recipient, amount, connection);
    if (typeof result === "string") {
      return { status: true, message: result };
    }
    return result as TransferResult;
  }
  const meta = await resolveMint(token, connection);
  if (!meta) {
    return { status: false, message: `Could not resolve token: ${token}` };
  }
  const result = await transferToken(
    recipient,
    meta.mint,
    amount,
    meta.decimals,
    connection
  );
  if (typeof result === "string") {
    return { status: true, message: result };
  }
  return result as TransferResult;
}

function asOptionalString(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  return String(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, ""))
        : NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function pajCashOrderId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return asOptionalString(
    record.id ??
      record.orderId ??
      record.order_id ??
      record.transactionId ??
      record.transaction_id ??
      record.reference ??
      record.referenceId ??
      record.reference_id ??
      record.paymentReference ??
      record.payment_reference
  );
}

function pajCashTokenAmount(
  data: unknown,
  fallback?: unknown
): number | undefined {
  if (!data || typeof data !== "object") return asFiniteNumber(fallback);
  const record = data as Record<string, unknown>;
  return asFiniteNumber(
    record.amount ??
      record.tokenAmount ??
      record.token_amount ??
      record.cryptoAmount ??
      record.crypto_amount ??
      record.receiveAmount ??
      record.receive_amount ??
      record.outputAmount ??
      record.output_amount ??
      fallback
  );
}
import {
  recordDepositTransaction,
  recordOfframpTransaction,
} from "@/services/appTransactions";

export class PajCash {
  public pajcashInitiate: FunctionParams;
  public pajcashVerify: FunctionParams;
  public pajitOfframp: FunctionParams;
  public pajcashOnramp: FunctionParams;
  public getNairaRate: FunctionParams;

  constructor(public session: VoiceAssistantSession) {
    this.pajcashInitiate = this.pajcash_initiate();
    this.pajcashVerify = this.pajcash_verify();
    this.pajitOfframp = this.pajit_offramp();
    this.pajcashOnramp = this.pajcash_onramp();
    this.getNairaRate = this.get_naira_rate();
  }

  private getStoredRecipient(fallback?: string): string | null {
    const fromTools =
      ToolsItem.getState()
        .getParameterValue(PAJ_APP, PAJ_CREDENTIALS, "email_or_phone")
        ?.trim() || "";
    const fromSession = PajCashSession.getState().recipient?.trim() || "";
    return (fallback?.trim() || fromTools || fromSession) || null;
  }

  pajcash_initiate() {
    return {
      name: "pajcash-initiate-session",
      description:
        "Send a PajCash OTP to the user's email or phone to start a PajCash onramp or offramp session.",
      parameters: {
        type: "object",
        properties: {
          email_or_phone: {
            type: "string",
            description:
              "User email or phone with country code, e.g. user@gmail.com or +2348012345678",
          },
        },
        required: ["email_or_phone"],
      },
      handler: async (args: { email_or_phone: string }) => {
        const messageId = this.session.functionMessageId;
        const res = await pajcash.initiateSession(args.email_or_phone);
        if (!res.status) {
          if (messageId !== null) completeConversation(messageId, "failed");
          return res.message;
        }
        ToolsItem.getState().updateToolParameter(PAJ_APP, PAJ_CREDENTIALS, {
          type: "email_or_phone",
          value: args.email_or_phone.trim(),
        });
        if (messageId !== null) completeConversation(messageId, "complete");
        const dest = res.data.email || res.data.phone || args.email_or_phone;
        return convertSpeech(
          `A verification code was sent to ${dest}. Ask the user for the OTP, then call pajcash-verify-session.`
        );
      },
    };
  }

  pajcash_verify() {
    return {
      name: "pajcash-verify-session",
      description:
        "Verify the PajCash OTP and activate the user's PajCash session for onramp and offramp.",
      parameters: {
        type: "object",
        properties: {
          otp: {
            type: "string",
            description: "The OTP code the user received from PajCash",
          },
          email_or_phone: {
            type: "string",
            description:
              "Optional if already stored; email or phone used in initiate",
          },
        },
        required: ["otp"],
      },
      handler: async (args: { otp: string; email_or_phone?: string }) => {
        const messageId = this.session.functionMessageId;
        const recipient = this.getStoredRecipient(args.email_or_phone);
        if (!recipient) {
          return "No email or phone on file. Call pajcash-initiate-session first.";
        }
        const res = await pajcash.verifySession(recipient, args.otp);
        if (!res.status) {
          if (messageId !== null) completeConversation(messageId, "failed");
          return res.message;
        }
        if (messageId !== null) completeConversation(messageId, "complete");
        return convertSpeech(
          "PajCash session is active. You can now onramp or offramp."
        );
      },
    };
  }

  pajit_offramp() {
    return {
      name: "pajit-offramp",
      description:
        "Offramp Solana tokens to Nigerian Naira via PajCash. Creates a Paj order and sends tokens to the deposit address.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "SPL token amount to offramp",
          },
          token: {
            type: "string",
            description: "SPL token symbol, name, or mint address",
          },
          fiat_amount: {
            type: "number",
            description:
              "Optional NGN amount to receive instead of specifying token amount",
          },
        },
        required: ["amount", "token"],
      },
      handler: async (args: {
        amount: number;
        token: string;
        fiat_amount?: number;
      }) => {
        const messageId = this.session.functionMessageId;
        const pk = WalletItem.getState().publicKey;
        if (!pk) return "Please connect your wallet";

        if (!pajcash.getSessionToken()) {
          return "PajCash is not connected. Use pajcash-initiate-session and pajcash-verify-session first.";
        }

        const accountNumber = ToolsItem.getState().getParameterValue(
          PAJ_APP,
          PAJ_OFFRAMP,
          "account_number"
        );
        const bankQuery =
          ToolsItem.getState().getParameterValue(PAJ_APP, PAJ_OFFRAMP, "bank_id") ||
          ToolsItem.getState().getParameterValue(PAJ_APP, PAJ_OFFRAMP, "bank");

        if (!accountNumber) {
          return "Set your bank account number in Pajcash app settings first.";
        }
        if (!bankQuery) {
          return "Set your bank name or bank_id in Pajcash app settings first.";
        }

        const bankIdRes = await pajcash.findBankId(bankQuery);
        if (!bankIdRes.status) return bankIdRes.message;

        const tokenLower = args.token.toLowerCase();
        if (tokenLower === "sol") {
          return "PajCash offramp supports SPL tokens, not native SOL. Swap SOL to an SPL token first.";
        }

        const conn = this.session.connection;
        const meta = await resolveMint(args.token, conn);
        if (!meta) {
          return `Could not resolve token for offramp: ${args.token}`;
        }

        const tokenBalance = await getTokenBalance(
          pk.toBase58(),
          meta.mint,
          meta.decimals,
          conn
        );
        if (!args.fiat_amount && tokenBalance < args.amount) {
          return `Insufficient ${meta.symbol} balance to offramp`;
        }

        const orderRes = await pajcash.createOfframp({
          bank: bankIdRes.data,
          accountNumber,
          currency: Currency.NGN,
          mint: meta.mint,
          chain: Chain.SOLANA,
          ...(args.fiat_amount
            ? { fiatAmount: args.fiat_amount }
            : { amount: args.amount }),
        });

        if (!orderRes.status) {
          if (messageId !== null) completeConversation(messageId, "failed");
          return orderRes.message;
        }

        const order = orderRes.data;
        const payAmount = order.amount;
        if (tokenBalance < payAmount) {
          return `Insufficient ${meta.symbol}. PajCash requires ${payAmount} ${meta.symbol} for this offramp.`;
        }

        const transfer = await sendTokens(
          args.token,
          payAmount,
          order.address,
          conn
        );

        if (!transfer.status) {
          if (messageId !== null) completeConversation(messageId, "failed");
          return transfer.message;
        }

        const confirmation = await conn.confirmTransaction(
          transfer.message,
          "confirmed"
        );

        if (confirmation) {
          const network = AppSettings.getState().networkShort;
          if (messageId !== null) {
            completeConversation(
              messageId,
              "complete",
              `https://explorer.solana.com/tx/${transfer.message}?cluster=${network}`
            );
          }
          recordOfframpTransaction({
            signature: transfer!.message,
            provider: "pajcash",
            app_called: "Pajcash",
            amount: args.amount,
            token: args.token.toUpperCase(),
            mint:
              args.token.toLowerCase() === "sol"
                ? "So11111111111111111111111111111111111111112"
                : meta.mint,
            recipient: order.address,
            raw_metadata: {
              account_number: accountNumber,
            },
          });
          return convertSpeech(
            `Offramp started. Sent ${payAmount} ${meta.symbol}. You should receive about ${order.fiatAmount} NGN. Order id ${order.id}.`
          );
        }

        if (messageId !== null) completeConversation(messageId, "failed");
        return `Transfer submitted but confirmation failed. Signature: ${transfer.message}`;
      },
    };
  }

  pajcash_onramp() {
    return {
      name: "pajcash-onramp",
      description:
        "Buy any supported Solana SPL token with Naira via PajCash. Creates an onramp order and returns Nigerian bank details for the user to pay. Use fiat_amount when the user gives a Naira amount; use token_amount when the user gives the amount of token they want to receive.",
      parameters: {
        type: "object",
        properties: {
          fiat_amount: {
            type: "number",
            description: "Amount in NGN to pay, e.g. 10000 for 10,000 NGN",
          },
          token_amount: {
            type: "number",
            description:
              "Optional token amount the user wants to receive. If provided without fiat_amount, quote the required NGN first.",
          },
          token: {
            type: "string",
            description: "SPL token to receive by symbol, name, or mint address",
          },
        },
        required: ["token"],
      },
      handler: async (args: {
        fiat_amount?: number;
        token_amount?: number;
        token: string;
      }) => {
        const messageId = this.session.functionMessageId;
        const pk = WalletItem.getState().publicKey;
        if (!pk) return "Please connect your wallet";

        if (!pajcash.getSessionToken()) {
          return "PajCash is not connected. Use pajcash-initiate-session and pajcash-verify-session first.";
        }

        const meta = await resolveMint(args.token, this.session.connection);
        if (!meta) {
          return `Could not resolve token for onramp: ${args.token}`;
        }

        let fiatAmount = args.fiat_amount;
        if (
          (!Number.isFinite(fiatAmount) || !fiatAmount || fiatAmount <= 0) &&
          Number.isFinite(args.token_amount) &&
          args.token_amount &&
          args.token_amount > 0
        ) {
          const fiatQuote = await pajcash.getFiatQuote(
            args.token_amount,
            meta.mint,
            Currency.NGN
          );
          if (!fiatQuote.status) {
            if (messageId !== null) completeConversation(messageId, "failed");
            return fiatQuote.message;
          }
          fiatAmount = Number(fiatQuote.data.fiatAmount);
        }

        if (!Number.isFinite(fiatAmount) || !fiatAmount || fiatAmount <= 0) {
          return `How much NGN do you want to spend, or how much ${meta.symbol} do you want to buy?`;
        }

        const orderRes = await pajcash.createOnramp({
          fiatAmount,
          currency: Currency.NGN,
          recipient: pk.toBase58(),
          mint: meta.mint,
          chain: Chain.SOLANA,
        });

        if (!orderRes.status) {
          if (messageId !== null) completeConversation(messageId, "failed");
          return orderRes.message;
        }

        const order = orderRes.data;
        const orderId = pajCashOrderId(order);
        const tokenAmount = pajCashTokenAmount(order, args.token_amount);
        if (orderId && tokenAmount != null) {
          recordDepositTransaction({
            client_reference: `pajcash:onramp:${orderId}`,
            provider: "pajcash",
            app_called: "Pajcash",
            amount: tokenAmount,
            token: meta.symbol,
            mint: meta.mint,
            recipient: pk.toBase58(),
            status: "pending",
            raw_metadata: {
              order_id: orderId,
              fiat_amount: String(order.fiatAmount),
              bank: String(order.bank),
              account_number: String(order.accountNumber),
              account_name: String(order.accountName),
              confirmation_source: "order_created",
            },
          });
        } else {
          console.warn("[PajCash Onramp] Skipping transaction record", {
            orderKeys: order && typeof order === "object" ? Object.keys(order) : [],
            hasOrderId: Boolean(orderId),
            hasAmount: tokenAmount != null,
          });
        }
        if (messageId !== null) {
          completeConversation(messageId, "complete");
          const toolMsg = Convo.getState().messages.find((m) => m.id === messageId);
          Convo.getState().updateMessage({
            messageId,
            source: toolMsg?.source ?? "voice",
            content: {
              messageType: "pajcash_onramp",
              pajcashOnrampPayment: {
                orderId: String(order.id),
                fiatAmount: String(order.fiatAmount),
                tokenAmount: String(order.amount),
                tokenSymbol: meta.symbol,
                accountNumber: String(order.accountNumber),
                accountName: String(order.accountName),
                bank: String(order.bank),
                recipient: pk.toBase58(),
              },
            },
          });
        }
        return convertSpeech(
          `Onramp order ${order.id} created. Pay ${order.fiatAmount} NGN to account ${order.accountNumber}, account name ${order.accountName}, bank ${order.bank}. You will receive about ${order.amount} ${meta.symbol} at ${pk.toBase58()}.`
        );
      },
    };
  }

  get_naira_rate() {
    return {
      name: "get-naira-rate",
      description:
        "Get the Naira value for a token amount using PajCash rates.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Token amount to quote",
          },
          token: {
            type: "string",
            description: "SPL token symbol, name, or mint address",
          },
        },
        required: ["amount", "token"],
      },
      handler: async (args: { amount: number; token: string }) => {
        const messageId = this.session.functionMessageId;
        const pk = WalletItem.getState().publicKey;
        if (!pk) return "Please connect your wallet";

        if (args.token.toLowerCase() !== "sol") {
          const meta = await resolveMint(args.token, this.session.connection);
          if (!meta) {
            return `Could not resolve token: ${args.token}`;
          }
          const balance = await getTokenBalance(
            pk.toBase58(),
            meta.mint,
            meta.decimals,
            this.session.connection
          );
          if (balance < args.amount) {
            return `Insufficient ${meta.symbol} balance`;
          }

          if (pajcash.getSessionToken()) {
            const fiatRes = await pajcash.getFiatQuote(
              args.amount,
              meta.mint,
              Currency.NGN
            );
            if (fiatRes.status) {
              if (messageId !== null) completeConversation(messageId, "complete");
              return convertSpeech(
                `${args.amount} ${meta.symbol} is about ${fiatRes.data.fiatAmount} NGN.`
              );
            }
          }
        }

        const rateResponse = await pajcash.getNairaRate(args.amount);
        if (!rateResponse.status) {
          if (messageId !== null) completeConversation(messageId, "failed");
          return rateResponse.message;
        }

        const userAmountFiat = rateResponse.data.amounts.userAmountFiat;
        if (messageId !== null) completeConversation(messageId, "complete");
        return convertSpeech(
          `The amount of ${args.amount} ${args.token} is equivalent to about ${userAmountFiat} NGN.`
        );
      },
    };
  }
}
