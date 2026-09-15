/**
 * MagicBlock Private Payments — agent-tool definitions.
 *
 * Exposes four tools to the voice/chat agent:
 *   - private_deposit_spl   : base SPL → ephemeral rollup
 *   - private_transfer_spl  : public or private SPL transfer
 *   - private_withdraw_spl  : ephemeral rollup → base SPL
 *   - check_private_balance : read ephemeral SPL balance (auth required)
 *
 * Defaults (visibility, split, delay, gasless, mint) are sourced from the
 * "MagicBlock Private Payments" entry in `ToolsItem` so the user can configure
 * them in Settings → Apps once and not have to re-state them in chat.
 */

import { Connection, PublicKey } from "@solana/web3.js";

import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";

import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import Convo from "@/utils/store/conversation.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import { getHeliusApiKeySync } from "@/services/rpcConfig";

import { convertSpeech } from "@/utils/functions/extrafunctions";
import { signTransactions } from "@/utils/wallet/signing";
import {
  completeConversation,
  getUserDetails,
  getVerifiedTokens,
  resolveTokenByQuery,
} from "@/utils/functions";
import { getTokenBalance } from "@/libs/tools/transfer/transfers";
import { recordAppTransactionAsync } from "@/services/appTransactions";

import {
  defaultUsdcMint,
  magicblock,
  MAGICBLOCK_DEFAULTS,
  MbBalanceLocation,
  MbBuiltTx,
  MbCluster,
  MbVisibility,
} from "./magicblock";
import { getMagicBlockToken } from "./magicblock.auth";

const APP_NAME = "magicblock";
const PUBKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const cluster = (): MbCluster => {
  const short = AppSettings.getState().networkShort;
  return short === "devnet" ? "devnet" : "mainnet";
};

const ephemeralRpcUrl = (c: MbCluster) =>
  c === "devnet"
    ? process.env.EXPO_PUBLIC_MAGICBLOCK_EPHEMERAL_DEVNET_RPC ||
      "https://devnet.magicblock.app"
    : process.env.EXPO_PUBLIC_MAGICBLOCK_EPHEMERAL_RPC ||
      "https://mainnet.magicblock.app";

const baseRpcUrl = () => {
  const network = AppSettings.getState().network;
  return `${network}${getHeliusApiKeySync()}`;
};

const getPref = (configType: string, paramType: string, fallback = "") =>
  ToolsItem.getState().getParameterValue(APP_NAME, configType, paramType) || fallback;

const resolveMintFromUserInput = async (
  input: string | undefined,
  c: MbCluster
): Promise<string> => {
  if (!input?.trim()) {
    const defaultSymbol = getPref("preferences", "default_mint", "USDC");
    if (defaultSymbol === "USDC") return defaultUsdcMint(c);
    const meta = await resolveTokenByQuery(defaultSymbol);
    return meta?.address ?? defaultUsdcMint(c);
  }
  const raw = input.trim();
  if (PUBKEY_REGEX.test(raw)) return raw;
  const meta = await resolveTokenByQuery(raw);
  return meta?.address ?? defaultUsdcMint(c);
};

const getDecimalsForMint = async (mint: string): Promise<number> => {
  const known = getVerifiedTokens().find((t) => t.address === mint);
  if (known) return known.decimals;
  const meta = await resolveTokenByQuery(mint);
  return meta?.decimals ?? 6;
};

const toBaseUnits = (amount: number, decimals: number): number =>
  Math.round(amount * Math.pow(10, decimals));

/**
 * Resolve a recipient handle to a wallet pubkey.
 * Accepts either a base58 pubkey directly or a HeySolana username.
 */
const resolveRecipient = async (input: string): Promise<string | null> => {
  if (PUBKEY_REGEX.test(input)) return input;
  try {
    const user = await getUserDetails(input);
    return user?.wallet_address || null;
  } catch {
    return null;
  }
};

const explorerUrl = (txid: string, c: MbCluster) =>
  `https://explorer.solana.com/tx/${txid}?cluster=${c}`;

const sendTx = async (built: MbBuiltTx, c: MbCluster, confirmMessage: string) => {
  const conn =
    built.sendTo === "ephemeral"
      ? new Connection(ephemeralRpcUrl(c))
      : new Connection(baseRpcUrl());
  const signed = await signTransactions({
    tx: built.transactionBase64,
    type: built.version === "v0" ? "versioned" : undefined,
    connection: conn,
    confirmMessage,
  });
  return { signed, conn };
};

export class MagicBlockTool {
  public privateDeposit: FunctionParams;
  public privateTransfer: FunctionParams;
  public privateWithdraw: FunctionParams;
  public privateBalance: FunctionParams;

  constructor(public session: SessionManager) {
    this.privateDeposit = this.private_deposit_spl();
    this.privateTransfer = this.private_transfer_spl();
    this.privateWithdraw = this.private_withdraw_spl();
    this.privateBalance = this.check_private_balance();
  }

  private fail(messageId: string | null, message: string) {
    if (messageId !== null) completeConversation(messageId, "failed");
    return message;
  }

  private private_deposit_spl(): FunctionParams {
    return {
      name: "private_deposit_spl",
      owner: "MagicBlock",
      description:
        "Move SPL tokens from the Solana base chain into the MagicBlock private ephemeral rollup so they can be transferred privately. Defaults to USDC.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Human-readable amount to deposit (e.g. 1.5 means 1.5 USDC).",
          },
          token: {
            type: "string",
            description:
              "Token symbol (USDC, USDT) or SPL mint pubkey. Defaults to USDC.",
          },
        },
        required: ["amount"],
      },
      handler: async (args: { amount: number; token?: string }) => {
        const messageId = this.session.functionMessageId;
        const owner = WalletItem.getState().publicKey?.toBase58();
        if (!owner) return this.fail(messageId, "Please connect your wallet to proceed.");

        const c = cluster();
        const mint = await resolveMintFromUserInput(args.token, c);
        const decimals = await getDecimalsForMint(mint);
        const baseUnits = toBaseUnits(args.amount, decimals);
        if (!Number.isFinite(baseUnits) || baseUnits < 1) {
          return this.fail(messageId, "Deposit amount must be at least 1 base unit.");
        }

        const built = await magicblock.deposit({
          owner,
          amount: baseUnits,
          cluster: c,
          mint,
          initIfMissing: true,
          initVaultIfMissing: true,
          initAtasIfMissing: true,
          idempotent: true,
        });

        if (!built.status) {
          return this.fail(
            messageId,
            `Deposit build failed: ${built.message}`
          );
        }

        const { signed } = await sendTx(
          built.data,
          c,
          `Deposit ${args.amount} ${args.token ?? "USDC"} into MagicBlock?`
        );
        if (!signed.status) return this.fail(messageId, signed.message);

        try {
          await new Connection(baseRpcUrl()).confirmTransaction(
            signed.message,
            "confirmed"
          );
        } catch {
          // best-effort confirmation; the tx may still be in-flight
        }

        if (messageId !== null) {
          completeConversation(messageId, "complete", explorerUrl(signed.message, c));
        }
        recordAppTransactionAsync({
          signature: signed.message,
          transaction_type: "deposit",
          status: "confirmed",
          provider: "magicblock",
          app_called: APP_NAME,
          input_token_mint: mint,
          input_token_symbol: args.token ?? "USDC",
          input_amount: args.amount,
          amount: args.amount,
          token: args.token ?? "USDC",
          raw_metadata: {
            balance_location: "ephemeral",
          },
        });
        return await convertSpeech(
          `Deposited ${args.amount} ${args.token ?? "USDC"} into your private MagicBlock balance.`
        );
      },
    };
  }

  private private_transfer_spl(): FunctionParams {
    return {
      name: "private_transfer_spl",
      owner: "MagicBlock",
      description:
        "Send SPL tokens to another wallet, optionally privately via MagicBlock's ephemeral rollup with a delayed/split settlement schedule. Use visibility='private' for confidential transfers.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description:
              "Recipient as a HeySolana username or a base58 wallet pubkey.",
          },
          amount: {
            type: "number",
            description: "Human-readable amount (e.g. 5 means 5 USDC).",
          },
          token: {
            type: "string",
            description: "Token symbol or SPL mint pubkey. Defaults to USDC.",
          },
          visibility: {
            type: "string",
            enum: ["public", "private"],
            description:
              "private routes through the ephemeral rollup with delay/split. public is a transparent SPL transfer.",
          },
          fromBalance: {
            type: "string",
            enum: ["base", "ephemeral"],
            description: "Where the sender holds the funds. Defaults to base.",
          },
          toBalance: {
            type: "string",
            enum: ["base", "ephemeral"],
            description: "Where the recipient should receive funds. Defaults to base.",
          },
          memo: {
            type: "string",
            description: "Optional UTF-8 memo to attach.",
          },
        },
        required: ["to", "amount"],
      },
      handler: async (args: {
        to: string;
        amount: number;
        token?: string;
        visibility?: MbVisibility;
        fromBalance?: MbBalanceLocation;
        toBalance?: MbBalanceLocation;
        memo?: string;
      }) => {
        const messageId = this.session.functionMessageId;
        const owner = WalletItem.getState().publicKey?.toBase58();
        if (!owner) return this.fail(messageId, "Please connect your wallet to proceed.");

        const c = cluster();
        const visibility: MbVisibility =
          args.visibility ??
          (getPref("preferences", "default_visibility", "private") as MbVisibility);
        const fromBalance: MbBalanceLocation = args.fromBalance ?? "base";
        const toBalance: MbBalanceLocation = args.toBalance ?? "base";
        const split = Number(getPref("preferences", "default_split", "1")) || 1;
        const minDelayMs = getPref("preferences", "default_min_delay_ms", "0");
        const maxDelayMs = getPref("preferences", "default_max_delay_ms", "0");
        const gasless = getPref("preferences", "gasless", "off") === "on";

        const recipient = await resolveRecipient(args.to);
        if (!recipient) {
          return this.fail(
            messageId,
            await convertSpeech(
              `Could not resolve "${args.to}" to a wallet. Provide a HeySolana username or a base58 address.`
            )
          );
        }

        const mint = await resolveMintFromUserInput(args.token, c);
        const decimals = await getDecimalsForMint(mint);
        const baseUnits = toBaseUnits(args.amount, decimals);
        if (!Number.isFinite(baseUnits) || baseUnits < 1) {
          return this.fail(messageId, "Transfer amount must be at least 1 base unit.");
        }

        if (fromBalance === "base") {
          const symbolGuess = args.token ?? "USDC";
          const heldBalance = await getTokenBalance(
            owner,
            mint,
            decimals,
            this.session.connection
          );
          if (heldBalance < args.amount) {
            return this.fail(
              messageId,
              await convertSpeech(`Insufficient ${symbolGuess} balance.`)
            );
          }
        }

        let bearer: string | undefined;
        if (visibility === "private" || fromBalance === "ephemeral") {
          try {
            bearer = await getMagicBlockToken({ cluster: c });
          } catch (err) {
            return this.fail(
              messageId,
              `Authentication with MagicBlock failed: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }

        const built = await magicblock.transfer(
          {
            from: owner,
            to: recipient,
            mint,
            amount: baseUnits,
            visibility,
            fromBalance,
            toBalance,
            cluster: c,
            initIfMissing: true,
            initAtasIfMissing: true,
            initVaultIfMissing: false,
            memo: args.memo,
            minDelayMs,
            maxDelayMs,
            split,
            gasless,
          },
          bearer
        );

        if (!built.status) {
          if (built.httpStatus === 401 && bearer) {
            try {
              bearer = await getMagicBlockToken({ cluster: c, force: true });
            } catch (err) {
              return this.fail(
                messageId,
                `Re-authentication failed: ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
            }
          } else {
            return this.fail(messageId, `Transfer build failed: ${built.message}`);
          }
        }

        let builtTx = built.status ? built.data : null;
        if (!builtTx) {
          const retry = await magicblock.transfer(
            {
              from: owner,
              to: recipient,
              mint,
              amount: baseUnits,
              visibility,
              fromBalance,
              toBalance,
              cluster: c,
              initIfMissing: true,
              initAtasIfMissing: true,
              initVaultIfMissing: false,
              memo: args.memo,
              minDelayMs,
              maxDelayMs,
              split,
              gasless,
            },
            bearer
          );
          if (!retry.status) {
            return this.fail(messageId, `Transfer build failed: ${retry.message}`);
          }
          builtTx = retry.data;
        }

        if (messageId !== null) {
          Convo.getState().updateMessage({
            messageId,
            content: {
              messageType: "magicblock",
              privateTransfer: {
                visibility,
                fromBalance,
                toBalance,
                split,
                minDelayMs,
                maxDelayMs,
                gasless,
                amount: args.amount,
                tokenSymbol: args.token ?? "USDC",
                recipient,
                validator: builtTx.validator ?? MAGICBLOCK_DEFAULTS.VALIDATOR,
                settlementProgress: 0,
              },
            },
            source: "voice",
          });
        }

        const confirmText =
          visibility === "private"
            ? `Send ${args.amount} ${args.token ?? "USDC"} privately?`
            : `Send ${args.amount} ${args.token ?? "USDC"} to ${args.to}?`;
        const { signed, conn } = await sendTx(builtTx, c, confirmText);
        if (!signed.status) return this.fail(messageId, signed.message);

        try {
          await conn.confirmTransaction(signed.message, "confirmed");
        } catch {
          // best-effort confirmation
        }

        if (messageId !== null) {
          Convo.getState().updateMessage({
            messageId,
            content: {
              privateTransfer: {
                visibility,
                fromBalance,
                toBalance,
                split,
                minDelayMs,
                maxDelayMs,
                gasless,
                amount: args.amount,
                tokenSymbol: args.token ?? "USDC",
                recipient,
                validator: builtTx.validator ?? MAGICBLOCK_DEFAULTS.VALIDATOR,
                settlementProgress: visibility === "private" ? 0 : split,
                txid: signed.message,
              },
            },
            source: "voice",
          });
          completeConversation(messageId, "complete", explorerUrl(signed.message, c));
        }

        recordAppTransactionAsync({
          signature: signed.message,
          transaction_type: visibility === "private" ? "private_transfer" : "transfer",
          status: "confirmed",
          provider: "magicblock",
          app_called: APP_NAME,
          input_token_mint: mint,
          input_token_symbol: args.token ?? "USDC",
          input_amount: args.amount,
          recipient_address: recipient,
          amount: args.amount,
          token: args.token ?? "USDC",
          raw_metadata: {
            visibility,
            from_balance: fromBalance,
            to_balance: toBalance,
            split,
            min_delay_ms: minDelayMs,
            max_delay_ms: maxDelayMs,
            gasless,
          },
        });

        return await convertSpeech(
          visibility === "private"
            ? `Scheduled a private transfer of ${args.amount} ${
                args.token ?? "USDC"
              }${split > 1 ? ` split into ${split} parts` : ""}.`
            : `Sent ${args.amount} ${args.token ?? "USDC"} to ${args.to}.`
        );
      },
    };
  }

  private private_withdraw_spl(): FunctionParams {
    return {
      name: "private_withdraw_spl",
      owner: "MagicBlock",
      description:
        "Move SPL tokens from your MagicBlock private ephemeral balance back to your Solana base-chain wallet.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Human-readable amount to withdraw.",
          },
          token: {
            type: "string",
            description: "Token symbol or mint. Defaults to USDC.",
          },
        },
        required: ["amount"],
      },
      handler: async (args: { amount: number; token?: string }) => {
        const messageId = this.session.functionMessageId;
        const owner = WalletItem.getState().publicKey?.toBase58();
        if (!owner) return this.fail(messageId, "Please connect your wallet to proceed.");

        const c = cluster();
        const mint = await resolveMintFromUserInput(args.token, c);
        const decimals = await getDecimalsForMint(mint);
        const baseUnits = toBaseUnits(args.amount, decimals);
        if (!Number.isFinite(baseUnits) || baseUnits < 1) {
          return this.fail(messageId, "Withdraw amount must be at least 1 base unit.");
        }

        const built = await magicblock.withdraw({
          owner,
          mint,
          amount: baseUnits,
          cluster: c,
          initIfMissing: true,
          initAtasIfMissing: true,
          idempotent: true,
        });
        if (!built.status) {
          return this.fail(messageId, `Withdraw build failed: ${built.message}`);
        }

        const { signed, conn } = await sendTx(
          built.data,
          c,
          `Withdraw ${args.amount} ${args.token ?? "USDC"} back to your base wallet?`
        );
        if (!signed.status) return this.fail(messageId, signed.message);

        try {
          await conn.confirmTransaction(signed.message, "confirmed");
        } catch {
          // best-effort confirmation
        }

        if (messageId !== null) {
          completeConversation(messageId, "complete", explorerUrl(signed.message, c));
        }
        recordAppTransactionAsync({
          signature: signed.message,
          transaction_type: "withdraw",
          status: "confirmed",
          provider: "magicblock",
          app_called: APP_NAME,
          input_token_mint: mint,
          input_token_symbol: args.token ?? "USDC",
          input_amount: args.amount,
          amount: args.amount,
          token: args.token ?? "USDC",
          raw_metadata: {
            balance_location: "base",
          },
        });
        return await convertSpeech(
          `Withdrew ${args.amount} ${args.token ?? "USDC"} from your private balance to your wallet.`
        );
      },
    };
  }

  private check_private_balance(): FunctionParams {
    return {
      name: "check_private_balance",
      owner: "MagicBlock",
      description:
        "Check the user's private MagicBlock SPL balance held inside the ephemeral rollup.",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token symbol or mint. Defaults to USDC.",
          },
        },
        required: [],
      },
      handler: async (args: { token?: string }) => {
        const messageId = this.session.functionMessageId;
        const owner = WalletItem.getState().publicKey?.toBase58();
        if (!owner) return this.fail(messageId, "Please connect your wallet to proceed.");

        const c = cluster();
        const mint = await resolveMintFromUserInput(args.token, c);

        let bearer: string;
        try {
          bearer = await getMagicBlockToken({ cluster: c });
        } catch (err) {
          return this.fail(
            messageId,
            `Authentication failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }

        let res = await magicblock.privateBalance(owner, mint, bearer, c);
        if (!res.status && res.httpStatus === 401) {
          try {
            bearer = await getMagicBlockToken({ cluster: c, force: true });
            res = await magicblock.privateBalance(owner, mint, bearer, c);
          } catch (err) {
            return this.fail(
              messageId,
              `Re-authentication failed: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
        if (!res.status) {
          return this.fail(messageId, `Could not read private balance: ${res.message}`);
        }

        const decimals = await getDecimalsForMint(mint);
        const human = Number(res.data.balance) / Math.pow(10, decimals);

        if (messageId !== null) completeConversation(messageId, "complete");
        return await convertSpeech(
          `Your private ${args.token ?? "USDC"} balance is ${human} on MagicBlock.`
        );
      },
    };
  }
}

// Force PublicKey symbol to remain referenced for module side-effect parity
// (helps tree-shaker keep web3 polyfills aligned with sibling tools).
void PublicKey;
