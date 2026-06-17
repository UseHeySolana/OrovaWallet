import AppSettings from "@/utils/store/settingsstore.store";
import type { VoiceAssistantSession } from "@/libs/voiceinfra/types";
import { FunctionParams } from "@/utils/types/types";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import {
  convertSpeech,
  signTransactions,
} from "@/utils/functions/extrafunctions";
import {
  completeConversation,
  getUserDetails,
  resolveTokenByQuery,
} from "@/utils/functions";
import { airBills } from "@/libs/tools/airbills/airbills";
import ToolsItem from "@/utils/store/toolsitems.store";
import { getTokenBalance } from "@/libs/tools/transfer/transfers";
import { recordAppTransactionAsync } from "@/services/appTransactions";

type ElectricityMeterType = "01" | "02";

type BuyElectricityArgs = {
  amount: number;
  meterNo?: string;
  meterNumber?: string;
  electId?: string;
  provider?: string;
  meterType?: string;
};

type BuyAirtimeArgs = {
  username?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  network?: string;
  networkId?: string;
  amount: number;
};

const ELECTRICITY_PROVIDERS: Record<string, string> = {
  "01": "01",
  ekedc: "01",
  eko: "01",
  "eko electric": "01",
  "02": "02",
  ikedc: "02",
  ikeja: "02",
  "ikeja electric": "02",
  "03": "03",
  aedc: "03",
  abuja: "03",
  "abuja electric": "03",
  "04": "04",
  kedc: "04",
  kano: "04",
  "kano electric": "04",
  "05": "05",
  phedc: "05",
  portharcourt: "05",
  "portharcourt electric": "05",
  "port harcourt": "05",
  "port harcourt electric": "05",
  "06": "06",
  jedc: "06",
  jos: "06",
  "jos electric": "06",
  "07": "07",
  ibedc: "07",
  ibadan: "07",
  "ibadan electric": "07",
  "08": "08",
  kaedc: "08",
  kaduna: "08",
  "kaduna electric": "08",
  "09": "09",
  eedc: "09",
  enugu: "09",
  "enugu electric": "09",
  "10": "10",
  bedc: "10",
  benin: "10",
  "benin electric": "10",
  "11": "11",
  yedc: "11",
  yola: "11",
  "yola electric": "11",
  "12": "12",
  aple: "12",
  aba: "12",
  "aba electric": "12",
};

const ELECTRICITY_METER_TYPES: Record<string, ElectricityMeterType> = {
  "01": "01",
  prepaid: "01",
  prepay: "01",
  "pre-paid": "01",
  "02": "02",
  postpaid: "02",
  postpay: "02",
  "post-paid": "02",
};

const normalizeLookupValue = (value?: string) =>
  String(value || "")
    .trim()
    .toLowerCase();

const resolveElectricityProvider = (value?: string) =>
  ELECTRICITY_PROVIDERS[normalizeLookupValue(value)] || value?.trim() || "";

const resolveMeterType = (value?: string) =>
  ELECTRICITY_METER_TYPES[normalizeLookupValue(value)] || "";

const AIRTIME_NETWORK_IDS: Record<string, string> = {
  "01": "01",
  mtn: "01",
  "02": "02",
  glo: "02",
  "03": "03",
  "9mobile": "03",
  etisalat: "03",
  "04": "04",
  airtel: "04",
};

const normalizeAirbillsPhoneNumber = (value?: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  if (!digits.startsWith("0") && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
};

const resolveAirtimeNetworkId = (value?: string) =>
  AIRTIME_NETWORK_IDS[normalizeLookupValue(value)] || "";

export class AirBills {
  public buyAirtime: FunctionParams;
  public buyElectricityBill: FunctionParams;

  constructor(public session: VoiceAssistantSession) {
    this.buyAirtime = this.buy_airtime();
    this.buyElectricityBill = this.buy_electricity_bill();
  }

  buy_electricity_bill() {
    return {
      name: "buy-electricity-bill",
      description:
        "This function is used to purchase an electricity bill for the user's own meter or another meter number. Ask for the meter number, provider, prepaid or postpaid meter type, and amount when they are not provided.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description:
              "This is the amount of electricity bill you want to purchase, it should be a number and in Naira.",
          },
          meterNo: {
            type: "string",
            description:
              "The electricity meter number to send the bill payment to.",
          },
          electId: {
            type: "string",
            enum: [
              "01",
              "02",
              "03",
              "04",
              "05",
              "06",
              "07",
              "08",
              "09",
              "10",
              "11",
              "12",
            ],
            description:
              "The electricity provider code: 01 Eko/EKEDC, 02 Ikeja/IKEDC, 03 Abuja/AEDC, 04 Kano/KEDC, 05 Port Harcourt/PHEDC, 06 Jos/JEDC, 07 Ibadan/IBEDC, 08 Kaduna/KAEDC, 09 Enugu/EEDC, 10 Benin/BEDC, 11 Yola/YEDC, 12 Aba/APLE.",
          },
          provider: {
            type: "string",
            description:
              "Alternative electricity provider name or acronym if electId is not known, for example EKEDC, Ikeja Electric, AEDC, or Ibadan.",
          },
          meterType: {
            type: "string",
            enum: ["01", "02", "prepaid", "postpaid"],
            description:
              "The meter type. Use 01/prepaid for prepaid meters or 02/postpaid for postpaid meters.",
          },
        },
        required: ["amount"],
      },
      handler: async (args: BuyElectricityArgs) => {
        const savedMeterNumber =
          ToolsItem.getState().getParameterValue(
            "Airbills",
            "electricity",
            "meter_number"
          ) ||
          ToolsItem.getState().getParameterValue(
            "Airbills",
            "electricty",
            "meter_number"
          );
        const savedElectId =
          ToolsItem.getState().getParameterValue(
            "Airbills",
            "electricity",
            "elect_id"
          ) ||
          ToolsItem.getState().getParameterValue(
            "Airbills",
            "electricty",
            "elect_id"
          );
        const savedMeterType =
          ToolsItem.getState().getParameterValue(
            "Airbills",
            "electricity",
            "meter_type"
          ) ||
          ToolsItem.getState().getParameterValue(
            "Airbills",
            "electricty",
            "meter_type"
          );

        const meter_number =
          args.meterNo?.trim() || args.meterNumber?.trim() || savedMeterNumber;
        const elect_id = resolveElectricityProvider(
          args.electId || args.provider || savedElectId
        );
        const type = resolveMeterType(args.meterType || savedMeterType);

        if (meter_number === "" || !meter_number)
          return "Please provide the meter number you want to buy electricity for";
        if (elect_id === "" || !elect_id)
          return "Please choose the electricity provider, for example Eko, Ikeja, Abuja, or Ibadan Electric";
        if (type === "" || !type)
          return "Please choose whether the meter is prepaid or postpaid";

        const response = await airBills.electricity.purchaseElectricity({
          amount: args.amount,
          token: "usdc",
          fee: 0,
          user_address: WalletItem.getState().publicKey?.toString() || "",
          meterNo: meter_number,
          electId: elect_id,
          prodId: type,
          batch: type,
        });
        if (!response.status)
          return (
            response.message ||
            "Electricity bill purchase failed, please try again"
          );
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
            recordAppTransactionAsync({
              signature: res.message,
              transaction_type: "electricity",
              status: "confirmed",
              provider: "airbills",
              app_called: "Airbills",
              input_token_symbol: "USDC",
              input_amount: args.amount,
              input_amount_usd: args.amount,
              amount: args.amount,
              token: "USDC",
              raw_metadata: {
                meter_number,
                elect_id,
                meter_type: type,
              },
            });
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
        "This function is used to purchase airtime credits for the user's own phone number, another Hey Solana username, or a direct mobile phone number. Ask for the phone number or username and amount when they are not provided.",
      parameters: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description:
              "The Hey Solana username of the person you are sending the airtime to.",
          },
          phoneNumber: {
            type: "string",
            description:
              "The mobile phone number to send airtime to. Use this when the recipient is not a Hey Solana username.",
          },
          networkId: {
            type: "string",
            enum: ["01", "02", "03", "04"],
            description:
              "Optional network code: 01 MTN, 02 Glo, 03 9mobile, 04 Airtel. If omitted, Airbills network-checker will detect it from the phone number.",
          },
          network: {
            type: "string",
            enum: ["MTN", "Glo", "9mobile", "Airtel"],
            description:
              "Optional network name. Use only if the user provides the mobile network.",
          },
          amount: {
            type: "number",
            description:
              "This is the amount of airtime you want to purchase, it should be a number",
          },
        },
        required: ["amount"],
      },

      handler: async (args: BuyAirtimeArgs) => {
        const pk = WalletItem.getState().publicKey?.toString() || "";
        if (!pk) {
          return "Please connect your wallet to proceed";
        }

        const usdcMeta = await resolveTokenByQuery("USDC");
        if (!usdcMeta) {
          return "USDC could not be resolved (configure EXPO_PUBLIC_JUP_API_KEY for Jupiter token search).";
        }

        const usdcBalance = await getTokenBalance(
          pk,
          usdcMeta.address,
          usdcMeta.decimals,
          this.session.connection
        );

        if (usdcBalance <= 0) {
          return "You do not have any USDC in your wallet, please swap some token and try again";
        }

        const user = UserItem.getState().user;
        let mobileNumber: string;

        const directPhone = args.phoneNumber || args.mobileNumber;
        if (directPhone?.trim()) {
          mobileNumber = normalizeAirbillsPhoneNumber(directPhone);
        } else if (
          !args.username ||
          args.username.toLowerCase() === user?.username.toLowerCase() ||
          args.username.toLowerCase() === "myself" ||
          args.username.toLowerCase() === "me"
        ) {
          mobileNumber = user?.mobileNumber || "";
        } else {
          const userCheck = await getUserDetails(args.username);

          console.log(userCheck);

          if (!userCheck) {
            const response = await convertSpeech(
              "Sorry there is no user on the Hey Solana App with that username"
            );
            return response;
          }
          mobileNumber = normalizeAirbillsPhoneNumber(userCheck.phoneNumber);
        }

        mobileNumber = normalizeAirbillsPhoneNumber(mobileNumber);

        if (!mobileNumber) {
          return "Please provide the mobile number you want to send airtime to";
        }

        const networkId = resolveAirtimeNetworkId(
          args.networkId || args.network
        );

        const userWalletAddress =
          WalletItem.getState().publicKey?.toString() || "";
        const keyPair = WalletItem.getState().keypair || null;
        if (!keyPair) {
          return "Please connect your wallet to proceed";
        }

        const response = await airBills.airtime.purchaseAirtime(
          mobileNumber,
          args.amount,
          userWalletAddress,
          networkId
        );

        if (!response.status)
          return response.message || "Airtime purchase failed, please try again";

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
            recordAppTransactionAsync({
              signature: res.message,
              transaction_type: "airtime",
              status: "confirmed",
              provider: "airbills",
              app_called: "Airbills",
              input_token_symbol: "USDC",
              input_amount: args.amount,
              input_amount_usd: args.amount,
              amount: args.amount,
              token: "USDC",
              raw_metadata: { mobile_number: mobileNumber },
            });
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
