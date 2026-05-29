import {
  initializeSDK,
  Environment,
  initiate,
  verify,
  getRateByAmount,
  getFiatValue,
  getBanks,
  resolveBankAccount,
  createOfframpOrder,
  createOnrampOrder,
  getTransaction,
  Currency,
  Chain,
  type DeviceSignature,
  type CreateOfframpOrder,
  type CreateOnrampOrder,
} from "paj_ramp";
import * as Device from "expo-device";
import Constants from "expo-constants";
import PajCashSession from "@/utils/store/pajcashSession.store";

let sdkInitialized = false;

function getApiKey(): string {
  const key = (process.env.EXPO_PUBLIC_PAJCASH_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "PajCash API key is not configured. Set EXPO_PUBLIC_PAJCASH_API_KEY in your .env file."
    );
  }
  return key;
}

function getWebhookUrl(): string {
  const url = (process.env.EXPO_PUBLIC_PAJCASH_WEBHOOK_URL || "").trim();
  if (url) return url;
  return "https://heysolana.app/api/pajcash/webhook";
}

function ensureSdkInitialized(): void {
  if (sdkInitialized) return;
  const envName = (
    process.env.EXPO_PUBLIC_PAJCASH_ENV || "staging"
  ).toLowerCase();
  const env =
    envName === "production"
      ? Environment.Production
      : envName === "local"
        ? Environment.Local
        : Environment.Staging;
  initializeSDK(env);
  sdkInitialized = true;
}

function formatPajError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
    if (Array.isArray(o.errors) && o.errors[0]) {
      return String(o.errors[0]);
    }
  }
  if (err instanceof Error) return err.message;
  return "PajCash request failed";
}

function getDeviceSignature(): DeviceSignature {
  const store = PajCashSession.getState();
  let uuid = store.deviceUuid;
  if (!uuid) {
    uuid =
      Constants.sessionId ||
      Constants.installationId ||
      `heysolana-${Date.now()}`;
    store.setDeviceUuid(uuid);
  }
  return {
    uuid,
    device: Device.modelName || "Mobile",
    os: Device.osName || undefined,
    browser: "HeySolana",
  };
}

type ApiResult<T> = { status: true; data: T } | { status: false; message: string };

async function wrap<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    ensureSdkInitialized();
    const data = await fn();
    return { status: true, data };
  } catch (err) {
    return { status: false, message: formatPajError(err) };
  }
}

const pajcash = {
  getApiKey,
  getWebhookUrl,
  ensureSdkInitialized,

  initiateSession: (emailOrPhone: string) =>
    wrap(() => initiate(emailOrPhone.trim(), getApiKey())),

  verifySession: (emailOrPhone: string, otp: string) =>
    wrap(async () => {
      const verified = await verify(
        emailOrPhone.trim(),
        otp.trim(),
        getDeviceSignature(),
        getApiKey()
      );
      PajCashSession.getState().setSession({
        recipient: emailOrPhone.trim(),
        token: verified.token,
        expiresAt: verified.expiresAt,
      });
      return verified;
    }),

  getSessionToken: (): string | null => {
    if (!PajCashSession.getState().isSessionValid()) return null;
    return PajCashSession.getState().token;
  },

  requireSessionToken: (): ApiResult<string> => {
    const token = pajcash.getSessionToken();
    if (!token) {
      return {
        status: false,
        message:
          "PajCash session expired or missing. Use pajcash-initiate-session and pajcash-verify-session first.",
      };
    }
    return { status: true, data: token };
  },

  getNairaRate: (amount: number) => wrap(() => getRateByAmount(amount)),

  getFiatQuote: (
    tokenAmount: number,
    mint: string,
    currency: Currency = Currency.NGN
  ) => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return Promise.resolve(session);
    return wrap(() =>
      getFiatValue({ amount: tokenAmount, mint, currency }, session.data)
    );
  },

  listBanks: () => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return Promise.resolve(session);
    return wrap(() => getBanks(session.data));
  },

  resolveBank: (bankId: string, accountNumber: string) => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return Promise.resolve(session);
    return wrap(() => resolveBankAccount(session.data, bankId, accountNumber));
  },

  createOfframp: (order: Omit<CreateOfframpOrder, "webhookURL">) => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return Promise.resolve(session);
    return wrap(() =>
      createOfframpOrder(
        { ...order, webhookURL: getWebhookUrl() },
        session.data
      )
    );
  },

  createOnramp: (order: Omit<CreateOnrampOrder, "webhookURL">) => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return Promise.resolve(session);
    return wrap(() =>
      createOnrampOrder(
        { ...order, webhookURL: getWebhookUrl() },
        session.data
      )
    );
  },

  getOrderStatus: (orderId: string) => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return Promise.resolve(session);
    return wrap(() => getTransaction(session.data, orderId));
  },

  findBankId: async (
    bankQuery: string
  ): Promise<ApiResult<string>> => {
    const banks = await pajcash.listBanks();
    if (!banks.status) return banks;
    const q = bankQuery.trim().toLowerCase();
    const match =
      banks.data.find((b) => b.id === bankQuery) ||
      banks.data.find((b) => b.code.toLowerCase() === q) ||
      banks.data.find((b) => b.name.toLowerCase() === q) ||
      banks.data.find((b) => b.name.toLowerCase().includes(q));
    if (!match) {
      return {
        status: false,
        message: `Could not find bank "${bankQuery}". Set bank_id in Pajcash settings or use a valid bank name.`,
      };
    }
    return { status: true, data: match.id };
  },
};

export { pajcash, Currency, Chain, formatPajError };
