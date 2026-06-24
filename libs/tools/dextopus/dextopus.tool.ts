import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import { completeConversation } from "@/utils/functions";
import { router } from "expo-router";
import {
  createDextopusDepositAddress,
  createDextopusQuote,
  DEXTOPUS_NATIVE_SOL_ASSET,
  DEXTOPUS_REFUND_REQUIRED_ORIGIN_CHAIN_IDS,
  DEXTOPUS_SOLANA_CHAIN_ID,
  DEXTOPUS_USDC_MAINNET,
  getDextopusChains,
  getDextopusTokens,
  listDextopusDeposits,
} from "@/services/dextopusApi";

const POPULAR_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  bsc: 56,
  avalanche: 43114,
  bitcoin: 8253038,
  btc: 8253038,
  tron: 728126428,
};

function resolveChainId(chain: string, chains: { chainId: number; name: string }[]): number | null {
  const normalized = chain.trim().toLowerCase();
  if (POPULAR_CHAIN_IDS[normalized]) {
    return POPULAR_CHAIN_IDS[normalized];
  }
  const match = chains.find((item) => item.name.toLowerCase().includes(normalized));
  return match?.chainId ?? null;
}

function resolveSettlementAsset(token: string): { asset: string; symbol: string } {
  const normalized = token.trim().toLowerCase();
  if (normalized === "sol") {
    return { asset: DEXTOPUS_NATIVE_SOL_ASSET, symbol: "SOL" };
  }
  return { asset: DEXTOPUS_USDC_MAINNET, symbol: "USDC" };
}

export class DextopusTool {
  public createCrossChainDepositAddress: FunctionParams;
  public bridgeCryptoQuote: FunctionParams;
  public checkCrossChainDeposits: FunctionParams;

  constructor(public session: SessionManager) {
    this.createCrossChainDepositAddress = this.create_cross_chain_deposit_address();
    this.bridgeCryptoQuote = this.bridge_crypto_quote();
    this.checkCrossChainDeposits = this.check_cross_chain_deposits();
  }

  private fail(messageId: string, message: string) {
    completeConversation(messageId, message);
    return { status: false, message };
  }

  private create_cross_chain_deposit_address(): FunctionParams {
    return {
      name: "create_cross_chain_deposit_address",
      description:
        "Create a reusable cross-chain deposit address. User sends crypto on another chain and receives USDC or SOL in their HeySolana wallet.",
      parameters: {
        type: "object",
        properties: {
          origin_chain: {
            type: "string",
            description: "Source chain name or id, e.g. Base, Ethereum, 8453.",
          },
          origin_token: {
            type: "string",
            description: "Token symbol on the source chain, e.g. USDC, ETH.",
          },
          receive_token: {
            type: "string",
            description: "Token to receive on Solana: USDC or SOL. Defaults to USDC.",
          },
        },
        required: ["origin_chain", "origin_token"],
      },
      handler: async (args: Record<string, string>, messageId: string) => {
        const walletAddress = WalletItem.getState().publicKey?.toString();
        if (!walletAddress) {
          return this.fail(messageId, "Connect your wallet first.");
        }

        try {
          const chains = await getDextopusChains();
          const originChainId = resolveChainId(args.origin_chain, chains);
          if (!originChainId) {
            return this.fail(messageId, `I couldn't find the chain "${args.origin_chain}".`);
          }
          if (DEXTOPUS_REFUND_REQUIRED_ORIGIN_CHAIN_IDS.has(originChainId)) {
            return this.fail(
              messageId,
              "Bitcoin and Tron cross-chain deposits are not supported yet."
            );
          }

          const tokens = await getDextopusTokens(originChainId, true);
          const tokenQuery = (args.origin_token || "USDC").trim().toLowerCase();
          const originToken =
            tokens.find((item) => item.symbol.toLowerCase() === tokenQuery) ||
            tokens.find((item) => item.name?.toLowerCase().includes(tokenQuery));

          if (!originToken) {
            return this.fail(
              messageId,
              `${args.origin_token} is not available for static deposits on that chain.`
            );
          }

          const settlement = resolveSettlementAsset(args.receive_token || "USDC");
          const address = await createDextopusDepositAddress({
            wallet_address: walletAddress,
            origin_chain_id: originChainId,
            origin_asset: originToken.address,
            origin_symbol: originToken.symbol,
            settlement_asset: settlement.asset,
            settlement_symbol: settlement.symbol,
            settlement_address: walletAddress,
          });

          completeConversation(
            messageId,
            `Your ${originToken.symbol} deposit address on ${args.origin_chain} is ready. Send funds to ${address.deposit_address} and you'll receive ${settlement.symbol} in your Solana wallet.`
          );

          router.push({
            pathname: "/dashboard/qrcode/crosschain",
            params: {
              chainId: String(originChainId),
              originAsset: originToken.address,
              originSymbol: originToken.symbol,
              settlementAsset: settlement.asset,
              settlementSymbol: settlement.symbol,
            },
          } as any);

          return {
            status: true,
            deposit_address: address.deposit_address,
            origin_chain_id: originChainId,
            origin_token: originToken.symbol,
            settlement_token: settlement.symbol,
          };
        } catch (err) {
          return this.fail(
            messageId,
            err instanceof Error ? err.message : "Failed to create cross-chain deposit address."
          );
        }
      },
    };
  }

  private bridge_crypto_quote(): FunctionParams {
    return {
      name: "bridge_crypto_quote",
      description:
        "Get a one-time cross-chain bridge quote and deposit address for a specific amount.",
      parameters: {
        type: "object",
        properties: {
          origin_chain: { type: "string", description: "Source chain, e.g. Base." },
          origin_token: { type: "string", description: "Source token symbol, e.g. USDC." },
          amount: { type: "string", description: "Amount in human-readable units, e.g. 25." },
          receive_token: { type: "string", description: "USDC or SOL on Solana. Defaults to USDC." },
          dry_run: {
            type: "boolean",
            description: "If true, only return the quote without creating a deposit request.",
          },
        },
        required: ["origin_chain", "origin_token", "amount"],
      },
      handler: async (args: Record<string, string | boolean>, messageId: string) => {
        const walletAddress = WalletItem.getState().publicKey?.toString();
        if (!walletAddress) {
          return this.fail(messageId, "Connect your wallet first.");
        }

        try {
          const chains = await getDextopusChains();
          const originChainId = resolveChainId(String(args.origin_chain || ""), chains);
          if (!originChainId) {
            return this.fail(messageId, `I couldn't find the chain "${args.origin_chain}".`);
          }

          const tokens = await getDextopusTokens(originChainId, false);
          const tokenQuery = String(args.origin_token || "USDC").trim().toLowerCase();
          const originToken =
            tokens.find((item) => item.symbol.toLowerCase() === tokenQuery) ||
            tokens.find((item) => item.name?.toLowerCase().includes(tokenQuery));

          if (!originToken) {
            return this.fail(messageId, `${args.origin_token} is not available on that chain.`);
          }

          const settlement = resolveSettlementAsset(String(args.receive_token || "USDC"));
          const humanAmount = Number(String(args.amount || "").replace(/,/g, ""));
          if (!Number.isFinite(humanAmount) || humanAmount <= 0) {
            return this.fail(messageId, "Enter a valid amount to bridge.");
          }

          const decimals = originToken.decimals ?? 6;
          const smallestUnit = Math.round(humanAmount * 10 ** decimals).toString();

          const quote = await createDextopusQuote({
            wallet_address: walletAddress,
            origin_chain_id: originChainId,
            destination_chain_id: DEXTOPUS_SOLANA_CHAIN_ID,
            origin_asset: originToken.address,
            destination_asset: settlement.asset,
            amount: smallestUnit,
            recipient: walletAddress,
            dry: args.dry_run === true,
          });

          if (!quote.success && quote.error) {
            return this.fail(messageId, quote.message || quote.error);
          }

          const message = args.dry_run
            ? `Estimated output: ${quote.estimatedOutput || "unknown"} ${settlement.symbol}.`
            : `Send ${args.amount} ${originToken.symbol} to ${quote.depositAddress}. Estimated output: ${quote.estimatedOutput || "pending"} ${settlement.symbol}.`;

          completeConversation(messageId, message);

          return {
            status: true,
            deposit_address: quote.depositAddress,
            request_id: quote.requestId,
            estimated_output: quote.estimatedOutput,
            estimated_time: quote.estimatedTime,
            expires_at: quote.expiresAt,
          };
        } catch (err) {
          return this.fail(
            messageId,
            err instanceof Error ? err.message : "Failed to get bridge quote."
          );
        }
      },
    };
  }

  private check_cross_chain_deposits(): FunctionParams {
    return {
      name: "check_cross_chain_deposits",
      description: "Check recent cross-chain deposits into the user's HeySolana wallet.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Optional status filter: pending, completed, failed, refunded.",
          },
        },
      },
      handler: async (args: Record<string, string>, messageId: string) => {
        const walletAddress = WalletItem.getState().publicKey?.toString();
        if (!walletAddress) {
          return this.fail(messageId, "Connect your wallet first.");
        }

        try {
          const deposits = await listDextopusDeposits(walletAddress, args.status);
          if (deposits.length === 0) {
            return this.fail(messageId, "You don't have any cross-chain deposits yet.");
          }

          const summary = deposits
            .slice(0, 5)
            .map((deposit) => {
              const from = deposit.origin_amount_formatted || deposit.origin_amount || "?";
              const to =
                deposit.settlement_amount_formatted || deposit.settlement_amount || "pending";
              return `${deposit.status}: ${from} to ${to}`;
            })
            .join("; ");

          completeConversation(messageId, `Recent cross-chain deposits: ${summary}`);
          return { status: true, deposits: deposits.slice(0, 5) };
        } catch (err) {
          return this.fail(
            messageId,
            err instanceof Error ? err.message : "Failed to load cross-chain deposits."
          );
        }
      },
    };
  }
}
