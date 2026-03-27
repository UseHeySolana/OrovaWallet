import { request } from "@/utils/request/db";
import { AIRBILLS } from "@/utils/constant";

const toErrorMessage = (result: any, fallback = "Request failed") => {
  if (typeof result?.message === "string" && result.message.trim()) {
    return result.message;
  }
  return fallback;
};

const isGatewaySuccess = (result: any) =>
  String(result?.status ?? "").trim() === "00";

const mapNetworkToId = (network: string): string | null => {
  const normalized = String(network || "").trim().toUpperCase();
  if (normalized === "MTN") return "01";
  if (normalized === "GLO") return "02";
  if (normalized === "9MOBILE" || normalized === "ETISALAT") return "03";
  if (normalized === "AIRTEL") return "04";
  return null;
};

const airBills = {
  baseUrl: "https://vendor.airbillspay.com/api/vendor/gateway",
  /**
   *
   * @param phone_number
   * @param amount
   * @param token
   * @param userWalletAddress
   * @returns
   */

  airtime: {
    detectNetwork: async (phone_number: string) => {
      const url = `${airBills.baseUrl}/network-checker?phone=${encodeURIComponent(phone_number)}`;
      try {
        const response = await request.getRan(url, { secretkey: AIRBILLS });
        const result = await response.json();
        if (!response.ok || !isGatewaySuccess(result)) {
          return { status: false, message: toErrorMessage(result) };
        }
        const networkId = mapNetworkToId(result?.data?.network);
        if (!networkId) {
          return {
            status: false,
            message: "Unable to determine network for this phone number",
          };
        }
        return { status: true, data: { networkId } };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },

    purchaseAirtime: async (
      phone_number: string,
      amount: number,
      userWalletAddress: string
    ) => {
      try {
        const networkResponse = await airBills.airtime.detectNetwork(phone_number);
        if (!networkResponse.status) {
          return {
            status: false,
            message:
              networkResponse.message || "Could not detect network for airtime",
          };
        }
        const networkId = networkResponse.data?.networkId;
        if (!networkId) {
          return {
            status: false,
            message: "Could not detect network for airtime",
          };
        }

        const url = `${airBills.baseUrl}/transact`;
        const data = {
          productCode: "100",
          payWith: "default",
          data: {
            pubKey: userWalletAddress,
            token: "USDC",
            amount: amount,
            phoneNumber: phone_number,
            networkId,
          },
        };
        const response = await request.postJsonRan(data, url, {
          secretkey: AIRBILLS,
        });
        const result = await response.json();

        if (!response.ok || !isGatewaySuccess(result)) {
          return {
            status: false,
            message: toErrorMessage(result, "Airtime purchase failed"),
          };
        }
        return {
          status: true,
          data: {
            id: result?.data?.id,
            ix: result?.data?.transactionIx,
            token: result?.data?.token,
            tokenMint: result?.data?.tokenMint,
            amountInToken: result?.data?.amountInToken,
          },
        };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },

    getAirtimePrice: async (amount: number) => {
      // New API no longer exposes a direct airtime quote endpoint.
      // Kept for compatibility with existing call sites.
      return { status: true, data: { usd: amount } };
    },

    /**
     *
     * @param id
     * @returns
     */
    completePurchase: async (id: string) => {
      const url = `${airBills.baseUrl}/transact/process`;
      const data = { productCode: "100", id: id };

      try {
        const response = await request.postJsonRan(data, url, {
          secretkey: AIRBILLS,
        });

        const result = await response.json();
        const status = String(result?.status ?? "");
        if (!response.ok || (!isGatewaySuccess(result) && status !== "06")) {
          return {
            status: false,
            message: toErrorMessage(result, "Airtime completion failed"),
          };
        }
        return { status: true, data: result };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },
  },

  electricity: {
    getElectricityCompanies: async () => {
      const url = `${airBills.baseUrl}/list/elect/01`;
      try {
        const response = await request.getRan(url, { secretkey: AIRBILLS });
        const result = await response.json();
        if (!response.ok || !isGatewaySuccess(result)) {
          return { status: false, message: toErrorMessage(result) };
        }
        return { status: true, data: result };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },

    verifyMeter: async (
      meter_number: string,
      elect_id: string,
      batch = "01"
    ) => {
      const url = `${airBills.baseUrl}/validate/elect/${batch}`;
      try {
        const payload = {
          meterNo: meter_number,
          electId: elect_id,
        };
        const response = await request.postJsonRan(payload, url, {
          secretkey: AIRBILLS,
        });
        const result = await response.json();
        if (!response.ok || !isGatewaySuccess(result)) {
          return { status: false, message: toErrorMessage(result) };
        }
        return { status: true, data: result };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },

    purchaseElectricity: async (data: {
      amount: number;
      token: string;
      fee: number;
      user_address: string;
      meterNo: string;
      electId: string;
      prodId: string;
      batch: string;
    }) => {
      const url = `${airBills.baseUrl}/transact`;
      try {
        const payload = {
          productCode: "101",
          payWith: "default",
          data: {
            pubKey: data.user_address,
            token: "USDC",
            amount: data.amount,
            meterNo: data.meterNo,
            electId: data.electId,
            prodId: data.prodId,
            batch: data.batch,
          },
        };
        const response = await request.postJsonRan(payload, url, {
          secretkey: AIRBILLS,
        });
        const result = await response.json();
        if (!response.ok || !isGatewaySuccess(result)) {
          return {
            status: false,
            message: toErrorMessage(result, "Electricity purchase failed"),
          };
        }
        return {
          status: true,
          data: {
            id: result?.data?.id,
            ix: result?.data?.transactionIx,
            token: result?.data?.token,
            tokenMint: result?.data?.tokenMint,
            amountInToken: result?.data?.amountInToken,
          },
        };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },

    completePurchase: async (id: string) => {
      const url = `${airBills.baseUrl}/transact/process`;
      const data = { productCode: "101", id: id };
      try {
        const response = await request.postJsonRan(data, url, {
          secretkey: AIRBILLS,
        });
        const result = await response.json();
        const status = String(result?.status ?? "");
        if (!response.ok || (!isGatewaySuccess(result) && status !== "06")) {
          return {
            status: false,
            message: toErrorMessage(result, "Electricity completion failed"),
          };
        }
        return { status: true, data: result };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },
  },
};

export { airBills };
