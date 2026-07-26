import {
  initializeSDK,
  Environment,
  initiate,
  verify,
  getAllRate,
  getFiatValue,
  getTokenValue,
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
import {
  clearPajCashSession,
  savePajCashSession,
} from "@/services/pajcashSessionApi";
import { getPajCashBusinessUsdcFee } from "@/services/pajcashFeeConfig";

const SOL_MINT = "So11111111111111111111111111111111111111112";

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
  return "https://hey.yraytestings.com.ng/api/pajcash/webhook";
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
  initializeSDK(Environment.Production);
  sdkInitialized = true;
}

export const PAJCASH_REVALIDATE_MESSAGE =
  "Your PajCash session expired. Enter your email or phone again to receive a new verification code.";

function isPajSessionInvalidError(err: unknown): boolean {
  if (typeof err === "string") {
    const lower = err.toLowerCase();
    return (
      lower.includes("session is invalid") ||
      lower.includes("session expired") ||
      lower.includes("unauthorized")
    );
  }
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (o.statusCode === 401) return true;
    const message =
      typeof o.message === "string" ? o.message.toLowerCase() : "";
    const error = typeof o.error === "string" ? o.error.toLowerCase() : "";
    return (
      message.includes("session is invalid") ||
      message.includes("session expired") ||
      error === "unauthorized"
    );
  }
  return false;
}

function formatPajError(err: unknown): string {
  if (isPajSessionInvalidError(err)) {
    return PAJCASH_REVALIDATE_MESSAGE;
  }
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const rawMessage = o.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.map(String).join(", ")
      : typeof rawMessage === "string"
        ? rawMessage.trim()
        : "";
    const error = typeof o.error === "string" ? o.error.trim() : "";
    if (message && error && /:\s*$/.test(message)) {
      return `${message} ${error}`;
    }
    if (message) return message;
    if (error) return error;
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
    store.setDeviceUuid(uuid as string);
  }
  return {
    uuid: uuid as string,
    device: Device.modelName || "Mobile",
    os: Device.osName || undefined,
    browser: "HeySolana",
  };
}

function normalizePajRecipient(recipient: string): string {
  const trimmed = recipient.trim();
  if (!trimmed || trimmed.includes("@")) return trimmed;

  const compact = trimmed.replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) {
    return compact;
  }
  if (compact.startsWith("234")) {
    return `+${compact}`;
  }
  if (/^0[789][01]\d{8}$/.test(compact)) {
    return `+234${compact.slice(1)}`;
  }

  return compact;
}

type ApiResult<T> = { status: true; data: T } | { status: false; message: string };

async function wrap<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    ensureSdkInitialized();
    const data = await fn();
    return { status: true, data };
  } catch (err) {
    if (isPajSessionInvalidError(err)) {
      PajCashSession.getState().clearSession();
      void clearPajCashSession().catch(() => {});
    }
    return { status: false, message: formatPajError(err) };
  }
}

export type PajUsdNgnRates = {
  /** 1 USD = X NGN (on-ramp / buy crypto with Naira). */
  on_ramp_ngn_per_usd: number;
  /** 1 USD = X NGN (off-ramp / sell crypto to Naira). */
  off_ramp_ngn_per_usd: number;
};

/**
 * PajCash `/pub/rate/{amount}` is currently broken (404 "No active rate found").
 * Use `/pub/rate` which still returns live onRamp/offRamp USD→NGN rates.
 */
async function fetchUsdNgnRates(): Promise<PajUsdNgnRates> {
  ensureSdkInitialized();
  const all = await getAllRate();
  const onRamp = Number(all?.onRampRate?.rate) || 0;
  const offRamp = Number(all?.offRampRate?.rate) || 0;
  if (onRamp <= 0 && offRamp <= 0) {
    throw new Error("PajCash USD/NGN rates unavailable");
  }
  return {
    on_ramp_ngn_per_usd: onRamp > 0 ? onRamp : offRamp,
    off_ramp_ngn_per_usd: offRamp > 0 ? offRamp : onRamp,
  };
}

async function fetchSolUsdPrice(): Promise<number> {
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`);
  if (!res.ok) throw new Error("Could not fetch SOL price");
  const json = (await res.json()) as Record<string, { usdPrice?: unknown }>;
  const price = Number(json?.[SOL_MINT]?.usdPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Invalid SOL price");
  }
  return price;
}

/**
 * Quote NGN (+ USD) for a SOL amount using PajCash USD/NGN + Jupiter SOL/USD.
 * Replaces broken getRateByAmount(amount) while keeping the same response shape.
 */
async function quoteSolAmountInNaira(amountSol: number) {
  const rates = await fetchUsdNgnRates();
  const solUsd = await fetchSolUsdPrice();
  const amountUSD = Number((amountSol * solUsd).toFixed(6));
  // Off-ramp style: what Naira you get when converting crypto → NGN.
  const ngnPerUsd = rates.off_ramp_ngn_per_usd;
  const userAmountFiat = Number((amountUSD * ngnPerUsd).toFixed(2));
  return {
    rate: {
      baseCurrency: "USD",
      targetCurrency: "NGN",
      rate: ngnPerUsd,
    },
    amounts: {
      userTax: 0,
      merchantTax: 0,
      amountUSD,
      userAmountFiat,
    },
  };
}

const pajcash = {
  getApiKey,
  getWebhookUrl,
  ensureSdkInitialized,

  initiateSession: (emailOrPhone: string) =>
    wrap(() => initiate(normalizePajRecipient(emailOrPhone), getApiKey())),

  verifySession: (emailOrPhone: string, otp: string) =>
    wrap(async () => {
      const recipient = normalizePajRecipient(emailOrPhone);
      console.log("[PajCash SDK] Verifying session", {
        recipient: recipient.includes("@") ? "email" : recipient,
      });
      const verified = await verify(
        recipient,
        otp.trim(),
        getDeviceSignature(),
        getApiKey()
      );

      PajCashSession.getState().setSession({
        recipient,
        token: verified.token,
        expiresAt: verified.expiresAt,
      });
      void savePajCashSession({
        recipient,
        token: verified.token,
        expiresAt: verified.expiresAt ?? null,
      }).catch((err) => {
        console.warn("[PajCash SDK] failed to persist session", err);
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
        message: PAJCASH_REVALIDATE_MESSAGE,
      };
    }
    return { status: true, data: token };
  },

  /** Live USD↔NGN rates from PajCash `/pub/rate` (not the broken `/pub/rate/{amount}`). */
  getUsdNgnRates: () => wrap(() => fetchUsdNgnRates()),

  /**
   * Quote NGN for a SOL amount. Uses `/pub/rate` + Jupiter (avoids broken `/pub/rate/{amount}`).
   */
  getNairaRate: (amount: number) => wrap(() => quoteSolAmountInNaira(amount)),

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

  getTokenQuote: (
    fiatAmount: number,
    mint: string,
    currency: Currency = Currency.NGN
  ) => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return Promise.resolve(session);
    return wrap(() =>
      getTokenValue({ fiatAmount, mint, currency }, session.data)
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

  createOfframp: async (
    order: Omit<CreateOfframpOrder, "webhookURL" | "fee"> & { fee?: number }
  ) => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return session;
    const businessFee =
      order.fee ?? (await getPajCashBusinessUsdcFee("offramp"));
    const { fee: _ignored, ...rest } = order;
    return wrap(() =>
      createOfframpOrder(
        {
          ...rest,
          webhookURL: getWebhookUrl(),
          ...(businessFee > 0 ? { fee: businessFee } : {}),
        },
        session.data
      )
    );
  },

  createOnramp: async (
    order: Omit<CreateOnrampOrder, "webhookURL" | "fee"> & { fee?: number }
  ) => {
    const session = pajcash.requireSessionToken();
    if (!session.status) return session;
    const businessFee =
      order.fee ?? (await getPajCashBusinessUsdcFee("onramp"));
    const { fee: _ignored, ...rest } = order;
    return wrap(() =>
      createOnrampOrder(
        {
          ...rest,
          webhookURL: getWebhookUrl(),
          ...(businessFee > 0 ? { fee: businessFee } : {}),
        },
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
