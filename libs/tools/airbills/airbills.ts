import { request } from "@/utils/request/db";
import { AIRBILLS } from "@/utils/constant";

const toErrorMessage = (result: any, fallback = "Request failed") => {
  if (typeof result === "string" && result.trim()) {
    return result;
  }
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

export const normalizeAirbillsPhoneNumber = (value?: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  if (!digits.startsWith("0") && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
};

const normalizeNetworkId = (networkId?: string): string | null => {
  const normalized = String(networkId || "").trim();
  return ["01", "02", "03", "04"].includes(normalized) ? normalized : null;
};

export type InternetPlan = {
  network: string;
  networkId: string;
  prodCode: string;
  prodId: string;
  prodName: string;
  prodAmount: number;
};

const NETWORK_ID_TO_PLAN_GROUP: Record<string, string> = {
  "01": "MTN",
  "02": "Glo",
  "03": "m_9mobile",
  "04": "Airtel",
};

const flattenInternetPlans = (
  dataPlan: Record<string, InternetPlan[] | undefined>,
  networkId: string
): InternetPlan[] => {
  const groupKey = NETWORK_ID_TO_PLAN_GROUP[networkId];
  if (groupKey && Array.isArray(dataPlan[groupKey])) {
    return dataPlan[groupKey]!;
  }
  return Object.values(dataPlan).flatMap((plans) => plans ?? []);
};

export const findInternetPlan = (
  plans: InternetPlan[],
  criteria: { prodId?: string; planName?: string; amount?: number }
): InternetPlan | null => {
  const prodId = String(criteria.prodId || "").trim();
  if (prodId) {
    const matches = plans.filter((plan) => plan.prodId === prodId);
    if (matches.length === 1) return matches[0];
    if (criteria.amount != null) {
      return (
        matches.find((plan) => Number(plan.prodAmount) === criteria.amount) ??
        null
      );
    }
    return matches[0] ?? null;
  }

  const planName = String(criteria.planName || "")
    .trim()
    .toLowerCase();
  if (planName) {
    const exact = plans.find(
      (plan) => plan.prodName.toLowerCase() === planName
    );
    if (exact) return exact;
    const partial = plans.filter((plan) =>
      plan.prodName.toLowerCase().includes(planName)
    );
    if (partial.length === 1) return partial[0];
    if (criteria.amount != null) {
      return (
        partial.find((plan) => Number(plan.prodAmount) === criteria.amount) ??
        null
      );
    }
    return partial[0] ?? null;
  }

  if (criteria.amount != null) {
    const matches = plans.filter(
      (plan) => Number(plan.prodAmount) === criteria.amount
    );
    return matches.length === 1 ? matches[0] : null;
  }

  return null;
};

const parseGatewayResponse = async (response: Response) => {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      status: "01",
      message: `Airbills returned a non-JSON response (${response.status})`,
    };
  }
};

const airBills = {
  baseUrl: "https://api.airbills.org/api/vendor/gateway",
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
        const response = await request.getRan(url, {
          Accept: "*/*",
          secretkey: AIRBILLS,
        });
        const result = await parseGatewayResponse(response);
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
        return {
          status: false,
          message:
            error instanceof Error
              ? error.message
              : "Could not detect network for airtime",
        };
      }
    },

    purchaseAirtime: async (
      phone_number: string,
      amount: number,
      userWalletAddress: string,
      preferredNetworkId?: string
    ) => {
      try {
        let networkId = normalizeNetworkId(preferredNetworkId);
        if (!networkId) {
          const networkResponse =
            await airBills.airtime.detectNetwork(phone_number);
          if (!networkResponse.status) {
            return {
              status: false,
              message:
                networkResponse.message || "Could not detect network for airtime",
            };
          }
          networkId = networkResponse.data?.networkId || null;
        }

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
        const result = await parseGatewayResponse(response);

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
        return {
          status: false,
          message:
            error instanceof Error ? error.message : "Airtime purchase failed",
        };
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

        const result = await parseGatewayResponse(response);
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
        return {
          status: false,
          message:
            error instanceof Error ? error.message : "Airtime completion failed",
        };
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

  internet: {
    listPlans: async (networkId: string) => {
      const normalizedNetworkId = normalizeNetworkId(networkId);
      if (!normalizedNetworkId) {
        return { status: false, message: "Invalid network ID for data plans" };
      }

      const url = `${airBills.baseUrl}/list/internet?networkId=${encodeURIComponent(normalizedNetworkId)}`;
      try {
        const response = await request.getRan(url, { secretkey: AIRBILLS });
        const result = await parseGatewayResponse(response);
        if (!response.ok || !isGatewaySuccess(result)) {
          return { status: false, message: toErrorMessage(result) };
        }

        const dataPlan = result?.data?.dataPlan ?? {};
        const batch = String(result?.data?.batch ?? "01");
        const plans = flattenInternetPlans(dataPlan, normalizedNetworkId);

        return {
          status: true,
          data: { batch, plans, networkId: normalizedNetworkId },
        };
      } catch (error) {
        console.log(error);
        return {
          status: false,
          message:
            error instanceof Error
              ? error.message
              : "Could not load data plans",
        };
      }
    },

    purchaseDataBundle: async (params: {
      phoneNumber: string;
      networkId: string;
      amount: number;
      prodId: string;
      batch: string;
      userWalletAddress: string;
      token?: string;
    }) => {
      const url = `${airBills.baseUrl}/transact`;
      try {
        const payload = {
          productCode: "102",
          payWith: "default",
          data: {
            pubKey: params.userWalletAddress,
            token: params.token ?? "USDC",
            amount: params.amount,
            phoneNumber: params.phoneNumber,
            networkId: params.networkId,
            prodId: params.prodId,
            batch: params.batch,
          },
        };
        const response = await request.postJsonRan(payload, url, {
          secretkey: AIRBILLS,
        });
        const result = await parseGatewayResponse(response);
        if (!response.ok || !isGatewaySuccess(result)) {
          return {
            status: false,
            message: toErrorMessage(result, "Data bundle purchase failed"),
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
        return {
          status: false,
          message:
            error instanceof Error
              ? error.message
              : "Data bundle purchase failed",
        };
      }
    },

    completePurchase: async (id: string) => {
      const url = `${airBills.baseUrl}/transact/process`;
      const data = { productCode: "102", id };
      try {
        const response = await request.postJsonRan(data, url, {
          secretkey: AIRBILLS,
        });
        const result = await parseGatewayResponse(response);
        const status = String(result?.status ?? "");
        if (!response.ok || (!isGatewaySuccess(result) && status !== "06")) {
          return {
            status: false,
            message: toErrorMessage(result, "Data bundle completion failed"),
          };
        }
        return { status: true, data: result };
      } catch (error) {
        console.log(error);
        return {
          status: false,
          message:
            error instanceof Error
              ? error.message
              : "Data bundle completion failed",
        };
      }
    },
  },
};

export { airBills };
