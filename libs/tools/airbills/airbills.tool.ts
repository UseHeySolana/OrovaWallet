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
import {
  completeConversation,
  getInTokenBalance,
  getUserDetails,
} from "@/utils/functions";
import { airBills } from "@/libs/tools/airbills/airbills";
import ToolsItem from "@/utils/store/toolsitems.store";

export class AirBills {
  public buyAirtime: FunctionParams;
  public buyElectricityBill: FunctionParams;

  constructor(public session: SessionManager) {
    this.buyAirtime = this.buy_airtime();
    this.buyElectricityBill = this.buy_electricity_bill();
  }

  buy_electricity_bill() {
    return {
      name: "buy-electricity-bill",
      description:
        "This function is used to purchase electricity bill for myself",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description:
              "This is the amount of electricity bill you want to purchase, it should be a number and in Naira.",
          },
        },
        required: ["amount"],
      },
      handler: async (args: { amount: number }) => {
        // if(!meter_number) return "You have not set your meter number, please set your meter number first";
        const meter_number = ToolsItem.getState().getParameterValue(
          "Airbills",
          "electricty",
          "meter_number"
        );
        const elect_id = ToolsItem.getState().getParameterValue(
          "Airbills",
          "electricty",
          "elect_id"
        );
        const type = ToolsItem.getState().getParameterValue(
          "Airbills",
          "electricty",
          "meter_type"
        );

        if (meter_number === "" || !meter_number)
          return "You have not set your meter number, please set your meter number first";
        if (elect_id === "" || !elect_id)
          return "You have not set your Electricy Provider yet, please set your electricity provider first";
        if (type === "" || !type)
          return "You have not set your meter type, please set your meter type first";

        const response = await airBills.electricity.purchaseElectricity({
          amount: args.amount,
          token: "usdc",
          fee: 0,
          user_address: WalletItem.getState().publicKey?.toString() || "",
          meterNo: meter_number,
          electId: elect_id,
          // Existing app setting stores meter_type as 01/02.
          // New API uses this value as the electricity batch and expects prodId too.
          prodId: type,
          batch: type,
        });
        if (!response.status)
          return "Electricity bill purchase failed, please try again";
        const result = response.data;
        const dataId = result.id;
        const transactionIx = result.ix;

        if (!transactionIx || !dataId) {
          return "Electricity bill purchase failed, missing transaction payload";
        }

        const res = await signTransactions({ tx: transactionIx });
        if (!res.status) {
          const messageId = this.session.functionMessageId;
          if (messageId !== null) completeConversation(messageId, "failed");
          return res.message;
        }
        const confirmation = await this.session.connection.confirmTransaction(
          res.message,
          "confirmed"
        );

        if (confirmation) {
          const completePurchaseRes =
            await airBills.electricity.completePurchase(dataId);
          if (completePurchaseRes.status) {
            const messageId = this.session.functionMessageId;
            const network = AppSettings.getState().networkShort;
            if (messageId !== null) {
              completeConversation(
                messageId,
                "complete",
                `https://explorer.solana.com/tx/${res.message}?cluster=${network}`
              );
            }
            return await convertSpeech(
              "Your electricity bill purchase is successfull"
            );
          } else {
            const messageId = this.session.functionMessageId;
            if (messageId !== null) {
              completeConversation(messageId, "failed");
            }
            return await convertSpeech("Electricity bill purchase failed!");
          }
        } else {
          const messageId = this.session.functionMessageId;
          if (messageId !== null) {
            completeConversation(messageId, "failed");
          }
          return await convertSpeech("Electricity bill purchase failed!");
        }
      },
    };
  }
  buy_airtime() {
    return {
      name: "buy-airtime",
      description:
        "This function is used to purchase airtime credits for a particular user either myself or on behalf of another user",
      parameters: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description:
              "This is the username of the person you are sending the airtime to, it should be a string",
          },
          amount: {
            type: "number",
            description:
              "This is the amount of airtime you want to purchase, it should be a number",
          },
        },
        required: ["username", "amount"],
      },

      handler: async (args: { username: string; amount: number }) => {
        const userDetails = this.session.userDetails;
        // Check if the user has that token
        const exist = userDetails.tokenAccounts.find(
          (item: any) => item?.symbol?.toLowerCase() === "usdc"
        );

        if (!exist) {
          return "You do not have any USDC in your wallet, please swap some token and try again";
        }

        const usdcBalance = getInTokenBalance("usdc");
        if (usdcBalance <= 0) return "Insufficient balance to purchase airtime";

        const user = UserItem.getState().user;
        let mobileNumber: string;

        if (args.username.toLowerCase() === user?.username.toLowerCase()) {
          mobileNumber = user.mobileNumber;
        } else {
          const userCheck = await getUserDetails(args.username);

          console.log(userCheck);

          if (!userCheck) {
            const response = await convertSpeech(
              "Sorry there is no user on the Hey Solana App with that username"
            );
            return response;
          }
          mobileNumber = cleanNumber(userCheck.phoneNumber);
        }

        const userWalletAddress =
          WalletItem.getState().publicKey?.toString() || "";
        const keyPair = WalletItem.getState().keypair || null;
        if (!keyPair) {
          return "Please connect your wallet to proceed";
        }

        const response = await airBills.airtime.purchaseAirtime(
          mobileNumber,
          args.amount,
          userWalletAddress
        );

        if (!response.status)
          return "Airtime purchase failed, please try again";

        const result = response.data;
        const dataId = result.id;
        const transactionIx = result.ix;

        if (!transactionIx || !dataId) {
          return "Airtime purchase failed, missing transaction payload";
        }

        const res = await signTransactions({ tx: transactionIx });
        if (!res.status) {
          const messageId = this.session.functionMessageId;
          if (messageId !== null) completeConversation(messageId, "failed");
          return res.message;
        }
        const confirmation = await this.session.connection.confirmTransaction(
          res.message,
          "confirmed"
        );

        if (confirmation) {
          const completePurchaseRes = await airBills.airtime.completePurchase(
            dataId
          );

          if (completePurchaseRes.status) {
            const messageId = this.session.functionMessageId;
            const network = AppSettings.getState().networkShort;
            if (messageId !== null) {
              completeConversation(
                messageId,
                "complete",
                `https://explorer.solana.com/tx/${res.message}?cluster=${network}`
              );
            }
            return await convertSpeech("Your airtime purchase is successfull");
          } else {
            const messageId = this.session.functionMessageId;
            if (messageId !== null) completeConversation(messageId, "failed");
            return await convertSpeech("Airtime purchase failed!");
          }
        } else {
          const messageId = this.session.functionMessageId;
          if (messageId !== null) {
            completeConversation(messageId, "failed");
          }

          return await convertSpeech("Airtime purchase failed!");
        }
      },
    };
  }
}
