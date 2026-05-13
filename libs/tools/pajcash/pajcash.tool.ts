import AppSettings from "@/utils/store/settingsstore.store";
import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import {
  completeConversation,
  verifiedTokens,
} from "@/utils/functions";
import { transferSol, transferToken, getTokenBalance } from "@/libs/tools/transfer/transfers";
import ToolsItem from "@/utils/store/toolsitems.store";
import { getBalance } from "@/utils/wallet";
import { pajcash } from "@/libs/tools/pajcash/pajcash";

export class PajCash {
  public pajitOfframp: FunctionParams;
  public getNairaRate: FunctionParams;
  private baseUrl = "https://api-staging.paj.cash";

  constructor(public session: SessionManager) {
    this.pajitOfframp = this.pajit_offramp();
    this.getNairaRate = this.get_naira_rate();
  }

  pajit_offramp() {
    return {
      name: "pajit-offramp",
      description:
        "This function is used to offramp your solana tokens to naira",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description:
              "This is the amount of solana tokens you want to offramp, it should be a number",
          },
          token: {
            type: "string",
            description:
              "This is the token you want to offramp, it should be a string",
          },
        },
        required: ["amount", "token"],
      },

      handler: async (args: { amount: number; token: string }) => {
        const messageId = this.session.functionMessageId;
        const pk = WalletItem.getState().publicKey;
        if (!pk) return "Please connect your wallet";

        const conn = this.session.connection;
        let tokenBalance: number;
        let splMint: string | undefined;
        let splDecimals: number | undefined;

        if (args.token.toLowerCase() === "sol") {
          tokenBalance = await getBalance(pk, conn);
        } else {
          const meta = verifiedTokens.find(
            (t) => t.symbol.toLowerCase() === args.token.toLowerCase()
          );
          if (!meta || meta.symbol === "SOL") {
            return `Unsupported token for offramp: ${args.token}`;
          }
          splMint = meta.address;
          splDecimals = meta.decimals;
          tokenBalance = await getTokenBalance(
            pk.toBase58(),
            meta.address,
            meta.decimals,
            conn
          );
        }

        if (tokenBalance < args.amount)
          return `Insufficient ${args.token} balance to offramp`;

        const accountNumber = ToolsItem.getState().getParameterValue(
          "Pajcash",
          "offramp",
          "account_number"
        );

        if (!accountNumber)
          return "You have not set your account number, please set your account number first";

        const recipient = "PAJiUaKgxTBJVADc1wdiUygLd51biQPVB8KkJqYu53L";

        let confirmation = null;
        let transfer: { status: boolean; message: string } | null = null;

        if (args.token.toLowerCase() === "sol") {
          transfer = await transferSol(
            recipient,
            args.amount,
            this.session.connection
          );
          if (!transfer.status) {
            if (messageId !== null) completeConversation(messageId, "failed");
            return transfer.message;
          }
          confirmation = await this.session.connection.confirmTransaction(
            transfer.message,
            "confirmed"
          );
        } else {
          if (!splMint || splDecimals == null) {
            return `Unsupported token for offramp: ${args.token}`;
          }
          transfer = await transferToken(
            recipient,
            splMint,
            args.amount,
            splDecimals,
            this.session.connection
          );
          if (!transfer.status) {
            if (messageId !== null) completeConversation(messageId, "failed");
            return transfer.message;
          }
          confirmation = await this.session.connection.confirmTransaction(
            transfer.message,
            "confirmed"
          );
        }

        if (confirmation) {
          const network = AppSettings.getState().networkShort;
          if (messageId !== null) {
            completeConversation(
              messageId,
              "complete",
              `https://explorer.solana.com/tx/${transfer!.message}?cluster=${network}`
            );
          }
          return `You have successfully Paj ${args.amount} ${args.token} to Naira`;
        } else {
          if (messageId !== null) {
            completeConversation(messageId, "failed");
          }
          return `Failed to Paj ${args.amount} ${args.token} to Naira`;
        }
      },
    };
  }
  get_naira_rate() {
    return {
      name: "get-naira-rate",
      description:
        "This function is used to get the naira rate of dollar value of a token",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description:
              "This is the amount of usdc tokens you want to offramp, it should be a number",
          },
          token: {
            type: "string",
            description:
              "This is the token you want to offramp, it should be a string",
          },
        },
        required: ["amount", "token"],
      },

      handler: async (args: { amount: number; token: string }) => {
        const messageId = this.session.functionMessageId;

        const pk = WalletItem.getState().publicKey;
        if (!pk) return "Please connect your wallet";
        const conn = this.session.connection;

        let tokenBalance: number;
        if (args.token.toLowerCase() === "sol") {
          tokenBalance = await getBalance(pk, conn);
        } else {
          const meta = verifiedTokens.find(
            (t) => t.symbol.toLowerCase() === args.token.toLowerCase()
          );
          if (!meta || meta.symbol === "SOL") {
            return `Unsupported token: ${args.token}`;
          }
          tokenBalance = await getTokenBalance(
            pk.toBase58(),
            meta.address,
            meta.decimals,
            conn
          );
        }

        if (tokenBalance < args.amount)
          return `Insufficient balance  of ${args.token} to offramp`;

        const rateResponse = await pajcash.getNairaRate(
          this.baseUrl,
          args.amount
        );
        if (!rateResponse.status) {
          if (messageId !== null) completeConversation(messageId, "failed");
          return "Failed to get naira rate";
        }

        const rateData = rateResponse.data;

        /**
         * {"rate":{"baseCurrency":"USD","targetCurrency":"NGN","rate":1600},"amounts":{"userTax":0.5,"merchantTax":0,"amountUSD":100,"userAmountFiat":159200}}
         */

        const userAmountFiat = rateData.amounts.userAmountFiat;

        if (messageId !== null) completeConversation(messageId, "complete");
        return convertSpeech(
          `The amount of ${args.amount} ${args.token} is equivalent to ${userAmountFiat} NGN`
        );
      },
    };
  }
}
