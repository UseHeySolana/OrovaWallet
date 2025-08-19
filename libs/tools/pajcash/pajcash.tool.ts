import AppSettings from "@/utils/store/settingsstore.store";
import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import {
  cleanNumber,
  convertSpeech,
  signTransactions,
} from "@/utils/functions/extrafunctions";
import Convo from "@/utils/store/conversation.store";
import {
  completeConversation,
  getInTokenBalance,
  getUserDetails,
  } from "@/utils/functions";
import { pajcash } from "@/libs/tools/pajcash/pajcash";
import { TransferFunction } from "@/libs/tools/transfer/transfer.tool";
import { transferSol, transferToken } from "@/libs/tools/transfer/transfers";
import ToolsItem from "@/utils/store/toolsitems.store";

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
        const tokenBalance = getInTokenBalance(args.token);

        const tokens: any = this.session.userDetails.tokenAccounts.filter(
          (item: any) =>
            item?.symbol?.toLowerCase() === args.token.toLowerCase()
        );

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
        let transfer = null;

        if (args.token.toLowerCase() == "sol") {
          transfer = await transferSol(
            recipient,
            args.amount,
            this.session.connection
          );

          confirmation = await this.session.connection.confirmTransaction(
            transfer.message,
            "confirmed"
          );
        } else {
          transfer = await transferToken(
            recipient,
            tokens[0].mint,
            args.amount,
            tokens[0].decimals,
            this.session.connection
          );
          confirmation = await this.session.connection.confirmTransaction(
            transfer.message,
            "confirmed"
          );
        }

        if (confirmation) {
          const messageId = this.session.functionMessageId;
          const network = AppSettings.getState().networkShort;
          if (messageId !== null) {
            completeConversation(
              messageId,
              "complete",
              `https://explorer.solana.com/tx/${transfer.message}?cluster=${network}`
            );
          }
          return `You have successfully Paj ${args.amount} ${args.token} to Naira`;
        } else {
          const messageId = this.session.functionMessageId;
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
        const userDetails = this.session.userDetails;

        const tokenBalance = getInTokenBalance(args.token);

        if (tokenBalance < args.amount)
          return `Insufficient balance  of ${args.token} to offramp`;

        const rateResponse = await pajcash.getNairaRate(
          this.baseUrl,
          args.amount
        );
        if (!rateResponse.status) return "Failed to get naira rate";

        const rateData = rateResponse.data;

        /**
         * {"rate":{"baseCurrency":"USD","targetCurrency":"NGN","rate":1600},"amounts":{"userTax":0.5,"merchantTax":0,"amountUSD":100,"userAmountFiat":159200}}
         */

        const userAmountFiat = rateData.amounts.userAmountFiat;

        return convertSpeech(
          `The amount of ${args.amount} ${args.token} is equivalent to ${userAmountFiat} NGN`
        );
      },
    };
  }
}
