import AppSettings from "@/utils/store/settingsstore.store";
import SessionManager from "@/libs/voiceinfra/SessionManager";
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
import { savePajCashBeneficiary } from "@/services/pajcashBeneficiariesApi";
import PajCashBeneficiaries, {
  type PajCashBeneficiary,
} from "@/utils/store/pajcashBeneficiaries.store";
import Convo from "@/utils/store/conversation.store";

const PAJ_APP = "pajcash";
const PAJ_OFFRAMP = "offramp";
const PAJ_CREDENTIALS = "credentials";

function getSavedOfframpAccount(): {
  accountNumber: string;
  bank: string;
  accountName?: string;
} | null {
  const accountNumber =
    ToolsItem.getState()
      .getParameterValue(PAJ_APP, PAJ_OFFRAMP, "account_number")
      ?.trim() || "";
  const bank =
    ToolsItem.getState()
      .getParameterValue(PAJ_APP, PAJ_OFFRAMP, "bank_id")
      ?.trim() ||
    ToolsItem.getState()
      .getParameterValue(PAJ_APP, PAJ_OFFRAMP, "bank")
      ?.trim() ||
    "";
  if (!accountNumber || !bank) return null;
  const accountName =
    ToolsItem.getState()
      .getParameterValue(PAJ_APP, PAJ_OFFRAMP, "account_name")
      ?.trim() || undefined;
  return { accountNumber, bank, accountName };
}

function formatBeneficiaryLine(b: PajCashBeneficiary, index: number): string {
  const name = b.accountName?.trim() || "Account";
  return `${index + 1}. ${name} — ${b.bankName} ${b.accountNumber}`;
}

/** Guidance for the assistant when bank destination was not provided. */
function missingBankDestinationGuidance(): string {
  const saved = getSavedOfframpAccount();
  const beneficiaries = PajCashBeneficiaries.getState().beneficiaries;

  if (saved) {
    const label = saved.accountName
      ? `${saved.accountName} (${saved.bank} ${saved.accountNumber})`
      : `${saved.bank} ${saved.accountNumber}`;
    const beneficiaryHint =
      beneficiaries.length > 0
        ? ` Saved beneficiaries: ${beneficiaries
            .slice(0, 5)
            .map(formatBeneficiaryLine)
            .join("; ")}.`
        : "";
    return `Ask whether to send to their saved account ${label}, or to another account. If another, they can pick a beneficiary or give a new 10-digit account number and bank name (do not ask for account name). When they give a bank name, call pajit-offramp so the tool can resolve or show bank cards (or use_saved_account: true).${beneficiaryHint}`;
  }

  if (beneficiaries.length > 0) {
    const list = beneficiaries
      .slice(0, 8)
      .map(formatBeneficiaryLine)
      .join("; ");
    return `No default bank account is set. Ask which beneficiary to use, or for a new 10-digit account number and bank name (do not ask for account name). Beneficiaries: ${list}. Then call pajit-offramp.`;
  }

  return "Ask for the Nigerian bank name and 10-digit account number only (do not ask for account name). Then call pajit-offramp with account_number and bank.";
}

/** Last resolved destination waiting for the user's name confirmation. */
type PendingOfframpConfirm = {
  bankId: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  amount: number;
  token: string;
};

let pendingOfframpConfirm: PendingOfframpConfirm | null = null;

function setPendingOfframpConfirm(pending: PendingOfframpConfirm) {
  pendingOfframpConfirm = pending;
}

function clearPendingOfframpConfirm() {
  pendingOfframpConfirm = null;
}

function matchesPendingOfframpConfirm(args: {
  bankId: string;
  accountNumber: string;
  amount: number;
  token: string;
}): boolean {
  const pending = pendingOfframpConfirm;
  if (!pending) return false;
  return (
    pending.bankId === args.bankId &&
    pending.accountNumber === args.accountNumber &&
    pending.amount === args.amount &&
    pending.token.toLowerCase() === args.token.toLowerCase()
  );
}

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
  connection?: SessionManager["connection"]
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
  connection?: SessionManager["connection"]
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
  connection: SessionManager["connection"]
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

  constructor(public session: SessionManager) {
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
        "Offramp Solana tokens to Nigerian Naira via PajCash. Call with amount, token, account_number, and bank search text. If several banks match, the app shows tappable cards — wait for bank_id. If exactly one bank matches, the tool resolves the account name immediately. Only after the user confirms that resolved name, call again with confirmed=true and the same bank_id. Never set confirmed=true on the first resolve call.",
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
          account_number: {
            type: "string",
            description:
              "10-digit Nigerian bank account number to receive Naira (own account or someone else's)",
          },
          bank: {
            type: "string",
            description:
              "Bank search text (e.g. Zenith, Palmpay, Opay). Used to find banks; cards appear only when multiple match.",
          },
          bank_id: {
            type: "string",
            description:
              "PajCash bank id from a selected bank card, or from a previous resolve step.",
          },
          use_saved_account: {
            type: "boolean",
            description:
              "If true, use the bank account saved in Pajcash settings (when present)",
          },
          confirmed: {
            type: "boolean",
            description:
              "Set true only after the user confirmed the resolved account name returned by a previous pajit-offramp call. Ignored if that confirm step has not happened yet.",
          },
        },
        required: ["amount", "token"],
      },
      handler: async (args: {
        amount: number;
        token: string;
        fiat_amount?: number;
        account_number?: string;
        bank?: string;
        bank_id?: string;
        use_saved_account?: boolean;
        confirmed?: boolean;
      }) => {
        const messageId = this.session.functionMessageId;
        const pk = WalletItem.getState().publicKey;
        if (!pk) return "Please connect your wallet";

        if (!pajcash.getSessionToken()) {
          return "PajCash is not connected. Use pajcash-initiate-session and pajcash-verify-session first.";
        }

        const saved = getSavedOfframpAccount();
        let accountNumber = args.account_number?.trim() || "";
        let bankQuery = args.bank?.trim() || "";
        let bankId = args.bank_id?.trim() || "";

        if (args.use_saved_account === true) {
          if (!saved) {
            return missingBankDestinationGuidance();
          }
          accountNumber = saved.accountNumber;
          bankQuery = saved.bank;
          if (!bankId && saved.bank && !/\s/.test(saved.bank) && saved.bank.length > 20) {
            bankId = saved.bank;
          }
        }

        if (accountNumber && !bankQuery && !bankId) {
          const match = PajCashBeneficiaries.getState().beneficiaries.find(
            (b) => b.accountNumber === accountNumber
          );
          if (match) {
            bankId = match.bankId;
            bankQuery = match.bankName;
          }
        }

        if (!accountNumber || (!bankQuery && !bankId)) {
          return missingBankDestinationGuidance();
        }

        // Resolve bank_id: search when missing. One hit → auto-select; many → cards.
        if (!bankId) {
          const search = await pajcash.searchBanks(bankQuery);
          if (!search.status) return search.message;
          if (search.data.length === 0) {
            return `No banks matched "${bankQuery}". Ask the user for another bank name.`;
          }

          if (search.data.length === 1) {
            bankId = search.data[0]!.id;
            bankQuery = search.data[0]!.name || bankQuery;
          } else {
            if (messageId !== null) {
              const toolMsg = Convo.getState().messages.find(
                (m) => m.id === messageId
              );
              Convo.getState().updateMessage({
                messageId,
                source: toolMsg?.source ?? "voice",
                content: {
                  messageType: "bank_search",
                  bankSearchPicker: {
                    query: bankQuery,
                    hits: search.data,
                    amount: args.amount,
                    token: args.token,
                    accountNumber,
                    fiatAmount: args.fiat_amount,
                  },
                },
              });
            }
            return `Found ${search.data.length} banks for "${bankQuery}". Tell the user to tap the correct bank card. Do not guess, do not set confirmed, and do not ask for account name yet.`;
          }
        }

        // Always resolve via PajCash before sending.
        const confirmedAccount = await pajcash.confirmBankAccount(
          bankQuery || bankId,
          accountNumber,
          { bankId }
        );
        if (!confirmedAccount.status) {
          clearPendingOfframpConfirm();
          return confirmedAccount.message;
        }

        const destination = confirmedAccount.data;
        PajCashBeneficiaries.getState().upsertBeneficiary({
          bankId: destination.bankId,
          bankName: destination.bankName,
          bankCode: destination.bankCode,
          accountNumber: destination.accountNumber,
          accountName: destination.accountName,
        });
        void savePajCashBeneficiary({
          bankId: destination.bankId,
          bankName: destination.bankName,
          bankCode: destination.bankCode,
          accountNumber: destination.accountNumber,
          accountName: destination.accountName,
        }).catch(() => {});

        const canFinalize =
          args.confirmed === true &&
          matchesPendingOfframpConfirm({
            bankId: destination.bankId,
            accountNumber: destination.accountNumber,
            amount: args.amount,
            token: args.token,
          });

        if (!canFinalize) {
          setPendingOfframpConfirm({
            bankId: destination.bankId,
            accountNumber: destination.accountNumber,
            accountName: destination.accountName,
            bankName: destination.bankName,
            amount: args.amount,
            token: args.token,
          });
          return `ONLY confirmation step: PajCash resolved ${destination.accountName} at ${destination.bankName}, account ${destination.accountNumber}. Ask once if that name is correct. If yes, call pajit-offramp with confirmed: true, bank_id "${destination.bankId}", account_number "${destination.accountNumber}", and the same amount/token. Never set confirmed on the first resolve.`;
        }

        clearPendingOfframpConfirm();

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
          bank: destination.bankId,
          accountNumber: destination.accountNumber,
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
              account_number: destination.accountNumber,
              account_name: destination.accountName,
              bank: destination.bankName,
              bank_id: destination.bankId,
            },
          });
          return convertSpeech(
            `Offramp started. Sent ${payAmount} ${meta.symbol} to ${destination.accountName}. You should receive about ${order.fiatAmount} NGN. Order id ${order.id}.`
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
        const tokenAmount = args.token_amount;
        const orderByTokenAmount =
          Number.isFinite(tokenAmount) && tokenAmount && tokenAmount > 0 &&
          (!Number.isFinite(fiatAmount) || !fiatAmount || fiatAmount <= 0);

        if (!orderByTokenAmount) {
          if (
            (!Number.isFinite(fiatAmount) || !fiatAmount || fiatAmount <= 0) &&
            Number.isFinite(tokenAmount) &&
            tokenAmount &&
            tokenAmount > 0
          ) {
            const fiatQuote = await pajcash.getFiatQuote(
              tokenAmount,
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
        }

        const orderRes = await pajcash.createOnramp({
          ...(orderByTokenAmount
            ? { amount: tokenAmount }
            : { fiatAmount }),
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
        const recordedTokenAmount = pajCashTokenAmount(order, args.token_amount);
        if (orderId && recordedTokenAmount != null) {
          recordDepositTransaction({
            client_reference: `pajcash:onramp:${orderId}`,
            provider: "pajcash",
            app_called: "Pajcash",
            amount: recordedTokenAmount,
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

        if (args.token.toLowerCase() !== "sol") {
          const meta = await resolveMint(args.token, this.session.connection);
          if (!meta) {
            return `Could not resolve token: ${args.token}`;
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
