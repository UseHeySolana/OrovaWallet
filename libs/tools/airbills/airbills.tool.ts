import AppSettings from "@/utils/store/settingsstore.store";
import SessionManager from "@/libs/voiceinfra/SessionManager";
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
import {
  airBills,
  findInternetPlan,
  normalizeAirbillsPhoneNumber,
} from "@/libs/tools/airbills/airbills";
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

type BuyDataBundleArgs = {
  username?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  network?: string;
  networkId?: string;
  prodId?: string;
  planName?: string;
  amount?: number;
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

const resolveAirtimeNetworkId = (value?: string) =>
  AIRTIME_NETWORK_IDS[normalizeLookupValue(value)] || "";

const formatInternetPlanOptions = (plans: { prodName: string; prodAmount: number; prodId: string }[]) => {
  const preview = plans.slice(0, 12);
  const lines = preview.map(
    (plan) => `${plan.prodName} — ₦${plan.prodAmount} (prodId: ${plan.prodId})`
  );
  if (plans.length > preview.length) {
    lines.push(`…and ${plans.length - preview.length} more plans`);
  }
  return lines.join("\n");
};

const resolveAirbillsMobileNumber = async (
  args: { username?: string; phoneNumber?: string; mobileNumber?: string },
  convertSpeechFn: typeof convertSpeech
) => {
  const directPhone = args.phoneNumber || args.mobileNumber;
  if (directPhone?.trim()) {
    return normalizeAirbillsPhoneNumber(directPhone);
  }

  const user = UserItem.getState().user;
  if (
    !args.username ||
    args.username.toLowerCase() === user?.username.toLowerCase() ||
    args.username.toLowerCase() === "myself" ||
    args.username.toLowerCase() === "me"
  ) {
    return normalizeAirbillsPhoneNumber(user?.mobileNumber || "");
  }

  const userCheck = await getUserDetails(args.username);
  if (!userCheck) {
    return {
      error: await convertSpeechFn(
        "Sorry there is no user on the Hey Solana App with that username"
      ),
    };
  }

  return normalizeAirbillsPhoneNumber(userCheck.phoneNumber);
};

export class AirBills {
  public buyAirtime: FunctionParams;
  public buyElectricityBill: FunctionParams;
  public buyDataBundle: FunctionParams;

  constructor(public session: SessionManager) {
    this.buyAirtime = this.buy_airtime();
    this.buyElectricityBill = this.buy_electricity_bill();
    this.buyDataBundle = this.buy_data_bundle();
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

  buy_data_bundle() {
    return {
      name: "buy-data-bundle",
      description:
        "Purchase a mobile data/internet bundle for the user's own phone number, another Hey Solana username, or a direct mobile phone number. Fetch plans from Airbills using the phone network, then match prodId or plan name. The amount must exactly match the plan price returned by Airbills.",
      parameters: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description:
              "The Hey Solana username of the person you are sending the data bundle to.",
          },
          phoneNumber: {
            type: "string",
            description:
              "The mobile phone number to send the data bundle to. Use this when the recipient is not a Hey Solana username.",
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
          prodId: {
            type: "string",
            description:
              "The data plan ID from Airbills /list/internet. Prefer this when the user picks a specific plan.",
          },
          planName: {
            type: "string",
            description:
              "Human-readable plan label to match against Airbills plan names, for example '1 GB Weekly' or '500 MB Monthly'.",
          },
          amount: {
            type: "number",
            description:
              "Exact plan price in NGN from the Airbills internet plan list. Required unless prodId uniquely identifies the plan.",
          },
        },
        required: [],
      },
      handler: async (args: BuyDataBundleArgs) => {
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

        const mobileResult = await resolveAirbillsMobileNumber(args, convertSpeech);
        if (typeof mobileResult === "object" && "error" in mobileResult) {
          return mobileResult.error;
        }
        const mobileNumber = mobileResult as string;

        if (!mobileNumber) {
          return "Please provide the mobile number you want to buy a data bundle for";
        }

        let networkId = resolveAirtimeNetworkId(args.networkId || args.network);
        if (!networkId) {
          const networkResponse =
            await airBills.airtime.detectNetwork(mobileNumber);
          if (!networkResponse.status) {
            return (
              networkResponse.message ||
              "Could not detect network for this phone number"
            );
          }
          networkId = networkResponse.data?.networkId || "";
        }

        if (!networkId) {
          return "Could not detect network for this phone number";
        }

        const plansResponse = await airBills.internet.listPlans(networkId);
        if (!plansResponse.status || !plansResponse.data?.plans?.length) {
          return (
            plansResponse.message ||
            "No data plans are available for this network right now"
          );
        }

        const { batch, plans } = plansResponse.data;
        const selectedPlan = findInternetPlan(plans, {
          prodId: args.prodId,
          planName: args.planName,
          amount: args.amount,
        });

        if (!selectedPlan) {
          if (!args.prodId && !args.planName && args.amount == null) {
            return `Please choose a data plan for this number:\n${formatInternetPlanOptions(plans)}`;
          }
          return `I couldn't match that data plan. Available plans:\n${formatInternetPlanOptions(plans)}`;
        }

        const keyPair = WalletItem.getState().keypair || null;
        if (!keyPair) {
          return "Please connect your wallet to proceed";
        }

        const response = await airBills.internet.purchaseDataBundle({
          phoneNumber: mobileNumber,
          networkId,
          amount: Number(selectedPlan.prodAmount),
          prodId: selectedPlan.prodId,
          batch,
          userWalletAddress: pk,
          token: "USDC",
        });

        if (!response.status) {
          return (
            response.message || "Data bundle purchase failed, please try again"
          );
        }

        const result = response.data;
        const dataId = result?.id;
        const transactionIx = result?.ix;

        if (!transactionIx || !dataId) {
          return "Data bundle purchase failed, missing transaction payload";
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
            await airBills.internet.completePurchase(dataId);

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
              transaction_type: "internet",
              status: "confirmed",
              provider: "airbills",
              app_called: "Airbills",
              input_token_symbol: "USDC",
              input_amount: Number(selectedPlan.prodAmount),
              input_amount_usd: Number(selectedPlan.prodAmount),
              amount: Number(selectedPlan.prodAmount),
              token: "USDC",
              raw_metadata: {
                mobile_number: mobileNumber,
                network_id: networkId,
                prod_id: selectedPlan.prodId,
                plan_name: selectedPlan.prodName,
              },
            });
            return await convertSpeech(
              `Your ${selectedPlan.prodName} data bundle purchase is successfull`
            );
          }

          const messageId = this.session.functionMessageId;
          if (messageId !== null) completeConversation(messageId, "failed");
          return await convertSpeech("Data bundle purchase failed!");
        }

        const messageId = this.session.functionMessageId;
        if (messageId !== null) {
          completeConversation(messageId, "failed");
        }

        return await convertSpeech("Data bundle purchase failed!");
      },
    };
  }
}
