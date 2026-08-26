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

  /**
   * Filter PajCash banks by name/code (same behavior as Send → Bank search).
   * Returns matches for the user to pick from a chat card — does not auto-select.
   */
  searchBanks: async (
    query: string
  ): Promise<
    ApiResult<
      Array<{
        id: string;
        name: string;
        code?: string;
        logo?: string;
      }>
    >
  > => {
    const banks = await pajcash.listBanks();
    if (!banks.status) return banks;
    const q = query.trim().toLowerCase();
    const list = Array.isArray(banks.data) ? banks.data : [];
    const mapped = list
      .map((b) => {
        const id = String((b as any)?.id ?? "").trim();
        const name = String((b as any)?.name ?? "").trim();
        const code = String((b as any)?.code ?? "").trim();
        const logo = String(
          (b as any)?.logo ??
            (b as any)?.image ??
            (b as any)?.logoUrl ??
            (b as any)?.logo_url ??
            ""
        ).trim();
        return {
          id,
          name,
          code: code || undefined,
          logo: logo || undefined,
        };
      })
      .filter((b) => b.id && b.name);

    if (!q) {
      return { status: true, data: mapped.slice(0, 40) };
    }

    const hits = mapped.filter((bank) => {
      const name = bank.name.toLowerCase();
      const code = (bank.code ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
    return { status: true, data: hits.slice(0, 40) };
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
    const found = await pajcash.findBank(bankQuery);
    if (!found.status) return found;
    return { status: true, data: found.data.id };
  },

  /** Match a bank from GET /pub/bank using id, code, name, or common aliases. */
  findBank: async (
    bankQuery: string
  ): Promise<
    ApiResult<{ id: string; name: string; code?: string }>
  > => {
    const banks = await pajcash.listBanks();
    if (!banks.status) return banks;

    const raw = bankQuery.trim();
    const q = normalizeBankQuery(raw);
    if (!q) {
      return {
        status: false,
        message: "Provide a bank name or bank code.",
      };
    }

    const queryTokens = tokenizeBankQuery(q);
    const wantsSecondary = SECONDARY_BANK_TOKENS.some((t) =>
      queryTokens.includes(t)
    );
    const list = Array.isArray(banks.data) ? banks.data : [];

    const scored = list
      .map((b) => {
        const id = String(b?.id ?? "").trim();
        const code = String(b?.code ?? "").trim().toLowerCase();
        const name = String(b?.name ?? "").trim();
        const nameNorm = normalizeBankQuery(name);
        if (!id || !nameNorm) {
          return { id, code, name, nameNorm, score: 0 };
        }

        let score = scoreBankMatch({
          query: q,
          queryTokens,
          id,
          code,
          nameNorm,
          raw,
        });

        // Prefer the main bank (PLC / "… bank") over wallet/mobile spinoffs
        // when the user did not ask for those products.
        if (score > 0 && !wantsSecondary) {
          if (isSecondaryBankProduct(nameNorm)) score -= 40;
          if (isPrimaryBankName(nameNorm)) score += 25;
        }

        return { id, code, name, nameNorm, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    if (scored.length === 0) {
      return {
        status: false,
        message: `Could not find bank "${bankQuery}". Ask for a valid Nigerian bank name or bank code.`,
      };
    }

    const top = scored[0];
    // Only ask to disambiguate when scores are nearly tied (e.g. two primary banks).
    const close = scored.filter((row) => row.score >= top.score - 8);
    if (close.length > 1 && top.score < 100) {
      const options = close
        .slice(0, 5)
        .map((row) => row.name || row.id)
        .join(", ");
      return {
        status: false,
        message: `Multiple banks match "${bankQuery}": ${options}. Ask which one.`,
      };
    }

    return {
      status: true,
      data: {
        id: top.id,
        name: top.name || top.id,
        code: top.code || undefined,
      },
    };
  },

  /**
   * Resolve bank via /pub/bank search, then confirm account via
   * /pub/bank-account/confirm?bankId=&accountNumber=
   * Prefer bankId when the user picked a bank card.
   */
  confirmBankAccount: async (
    bankQueryOrId: string,
    accountNumber: string,
    options?: { bankId?: string }
  ): Promise<
    ApiResult<{
      bankId: string;
      bankName: string;
      bankCode?: string;
      accountNumber: string;
      accountName: string;
    }>
  > => {
    const normalizedAccount = accountNumber.replace(/\D/g, "");
    if (normalizedAccount.length !== 10) {
      return {
        status: false,
        message:
          "Nigerian bank account numbers are 10 digits. Ask the user for the full account number.",
      };
    }

    let bankId = options?.bankId?.trim() || "";
    let bankName = "";
    let bankCode: string | undefined;

    if (bankId) {
      const banks = await pajcash.listBanks();
      if (banks.status) {
        const match = (Array.isArray(banks.data) ? banks.data : []).find(
          (b) => String((b as any)?.id ?? "") === bankId
        );
        if (match) {
          bankName = String((match as any)?.name ?? "").trim();
          bankCode = String((match as any)?.code ?? "").trim() || undefined;
        }
      }
      if (!bankName) bankName = bankQueryOrId || bankId;
    } else {
      const bankRes = await pajcash.findBank(bankQueryOrId);
      if (!bankRes.status) return bankRes;
      bankId = bankRes.data.id;
      bankName = bankRes.data.name;
      bankCode = bankRes.data.code;
    }

    const resolved = await pajcash.resolveBank(bankId, normalizedAccount);
    if (!resolved.status) return resolved;

    const data = resolved.data as unknown as Record<string, unknown>;
    const bankObj =
      data.bank && typeof data.bank === "object"
        ? (data.bank as Record<string, unknown>)
        : {};
    const accountName = String(
      data.accountName ?? data.account_name ?? data.name ?? ""
    ).trim();
    const confirmedAccount = String(
      data.accountNumber ?? data.account_number ?? normalizedAccount
    ).trim();
    bankName = String(bankObj.name ?? bankName ?? bankQueryOrId).trim();
    bankId = String(bankObj.id ?? bankId).trim();
    bankCode = String(bankObj.code ?? bankCode ?? "").trim() || undefined;

    if (!accountName) {
      return {
        status: false,
        message: `Could not confirm account ${normalizedAccount} at ${bankName}. Check the bank and account number.`,
      };
    }

    return {
      status: true,
      data: {
        bankId,
        bankName,
        bankCode,
        accountNumber: confirmedAccount || normalizedAccount,
        accountName,
      },
    };
  },
};

/** Normalize bank search text for matching. */
function normalizeBankQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeBankQuery(value: string): string[] {
  return normalizeBankQuery(value).split(" ").filter(Boolean);
}

const SECONDARY_BANK_TOKENS = [
  "wallet",
  "mobile",
  "eazy",
  "easy",
  "digital",
  "mfb",
  "microfinance",
];

function isSecondaryBankProduct(nameNorm: string): boolean {
  const tokens = tokenizeBankQuery(nameNorm);
  // Also catch glued names like "zenithmobile"
  const compact = nameNorm.replace(/\s+/g, "");
  return SECONDARY_BANK_TOKENS.some(
    (token) => tokens.includes(token) || compact.endsWith(token)
  );
}

function isPrimaryBankName(nameNorm: string): boolean {
  return (
    nameNorm.includes(" plc") ||
    nameNorm.endsWith(" plc") ||
    /(^| )bank( |$)/.test(nameNorm)
  );
}

function scoreBankMatch(args: {
  query: string;
  queryTokens: string[];
  id: string;
  code: string;
  nameNorm: string;
  raw: string;
}): number {
  const { query, queryTokens, id, code, nameNorm, raw } = args;
  if (id && (id === raw || id.toLowerCase() === query)) return 120;
  if (code && code === query) return 115;
  if (nameNorm === query) return 110;

  const nameTokens = tokenizeBankQuery(nameNorm);
  const brandTokens = queryTokens.filter(
    (t) => t !== "bank" && t !== "plc" && t !== "nigeria"
  );

  // Contiguous / prefix-style matches beat loose includes.
  if (nameNorm.startsWith(query)) return 100;
  if (nameNorm.includes(` ${query}`) || nameNorm.includes(query)) {
    // "zenith bank" inside "zenith bank plc" — strong
    if (queryTokens.every((t) => nameTokens.includes(t) || nameNorm.includes(t))) {
      return 95;
    }
    return 75;
  }

  // All significant query tokens present in the bank name.
  if (
    brandTokens.length > 0 &&
    brandTokens.every((t) => nameTokens.some((n) => n.startsWith(t) || t.startsWith(n)))
  ) {
    let score = 70 + brandTokens.length * 5;
    if (queryTokens.includes("bank") && nameTokens.includes("bank")) score += 10;
    if (queryTokens.includes("plc") && nameTokens.includes("plc")) score += 10;
    return score;
  }

  // Alias map (Opay → Paycom, etc.)
  const aliasTargets = BANK_ALIASES[query];
  if (aliasTargets?.some((alias) => nameNorm.includes(alias))) {
    return 88;
  }
  for (const [alias, targets] of Object.entries(BANK_ALIASES)) {
    if (!nameNorm.includes(alias)) continue;
    if (targets.some((t) => query === t || query.includes(t) || t.includes(query))) {
      return 82;
    }
  }

  // Single-token brand overlap (e.g. query "zenith" vs "zenith bank plc")
  if (
    brandTokens.length === 1 &&
    nameTokens.some(
      (n) => n === brandTokens[0] || n.startsWith(brandTokens[0]!)
    )
  ) {
    return 65;
  }

  return 0;
}

/** Common spoken/brand names → substrings found in PajCash bank list names. */
const BANK_ALIASES: Record<string, string[]> = {
  opay: ["paycom", "opay"],
  paycom: ["paycom", "opay"],
  palmpay: ["palmpay", "palm pay"],
  kuda: ["kuda"],
  gtb: ["guaranty trust", "gtbank", "gt bank"],
  gtbank: ["guaranty trust", "gtbank"],
  "guaranty trust": ["guaranty trust", "gtbank"],
  access: ["access bank"],
  uba: ["united bank for africa", "uba"],
  zenith: ["zenith"],
  firstbank: ["first bank"],
  "first bank": ["first bank"],
  fidelity: ["fidelity"],
  sterling: ["sterling"],
  moniepoint: ["moniepoint", "monie point"],
  "monie point": ["moniepoint", "monie point"],
  carbon: ["carbon"],
  fairmoney: ["fairmoney", "fair money"],
};

export { pajcash, Currency, Chain, formatPajError };
