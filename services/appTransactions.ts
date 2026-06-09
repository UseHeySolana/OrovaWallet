import { BASE_URL } from "@/utils/constant";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";

export type AppTransactionCluster = "mainnet" | "devnet";
export type AppTransactionStatus = "pending" | "submitted" | "confirmed" | "failed";
export type AppTransactionType =
  | "swap"
  | "transfer"
  | "airtime"
  | "electricity"
  | "commerce"
  | "offramp"
  | "deposit"
  | "withdraw"
  | "private_transfer"
  | "other";

export interface RecordAppTransactionPayload {
  client_reference?: string;
  signature?: string;
  cluster?: AppTransactionCluster;
  wallet_address?: string;
  username?: string;
  mobile_number?: string;
  transaction_type: AppTransactionType;
  status?: AppTransactionStatus;
  provider?: string;
  amount?: number;
  token?: string;
  input_token_mint?: string;
  input_token_symbol?: string;
  input_amount?: number;
  input_amount_usd?: number;
  output_token_mint?: string;
  output_token_symbol?: string;
  output_amount?: number;
  output_amount_usd?: number;
  platform_fee_amount?: number;
  platform_fee_token?: string;
  platform_fee_usd?: number;
  network_fee_lamports?: number;
  recipient_address?: string;
  app_called?: string;
  raw_metadata?: Record<string, unknown>;
}

export interface AppTransaction {
  id: number;
  client_reference?: string | null;
  signature?: string | null;
  cluster: AppTransactionCluster;
  wallet_address: string;
  username?: string | null;
  mobile_number?: string | null;
  transaction_type: AppTransactionType | string;
  status: AppTransactionStatus;
  provider?: string | null;
  amount?: string | number | null;
  token?: string | null;
  input_token_mint?: string | null;
  input_token_symbol?: string | null;
  input_amount?: string | number | null;
  input_amount_usd?: string | number | null;
  output_token_mint?: string | null;
  output_token_symbol?: string | null;
  output_amount?: string | number | null;
  output_amount_usd?: string | number | null;
  platform_fee_amount?: string | number | null;
  platform_fee_token?: string | null;
  platform_fee_usd?: string | number | null;
  network_fee_lamports?: number | null;
  recipient_address?: string | null;
  app_called?: string | null;
  raw_metadata?: Record<string, unknown> | null;
  confirmed_at?: string | null;
  created_at?: string | null;
}

type AppTransactionResponse<T> =
  | { status: true; data: T }
  | { status: false; message?: string };

function currentCluster(): AppTransactionCluster {
  return AppSettings.getState().networkShort === "devnet" ? "devnet" : "mainnet";
}

/** Best-effort USD notional for TVP when callers omit input_amount_usd. */
export function resolveInputAmountUsd(params: {
  amount: number;
  token?: string;
  mint?: string;
  input_amount_usd?: number;
}): number | undefined {
  if (params.input_amount_usd != null && Number.isFinite(params.input_amount_usd)) {
    return params.input_amount_usd;
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return undefined;
  }

  const token = params.token?.trim().toUpperCase();
  if (token === "USDC" || token === "USDT") {
    return params.amount;
  }

  return estimateUsdFromWalletToken(params.mint, params.amount);
}

function enrichPayload(
  payload: RecordAppTransactionPayload
): RecordAppTransactionPayload {
  const wallet =
    payload.wallet_address ?? WalletItem.getState().publicKey?.toString() ?? "";
  const user = UserItem.getState().user;

  const enriched: RecordAppTransactionPayload = {
    cluster: currentCluster(),
    wallet_address: wallet,
    username: payload.username ?? user?.username,
    mobile_number: payload.mobile_number ?? user?.mobileNumber,
    status: payload.status ?? "confirmed",
    ...payload,
  };

  if (enriched.input_amount_usd == null && enriched.input_amount != null) {
    enriched.input_amount_usd = resolveInputAmountUsd({
      amount: enriched.input_amount,
      token: enriched.input_token_symbol ?? enriched.token,
      mint: enriched.input_token_mint,
    });
  }

  return enriched;
}

/**
 * POST /api/v2/app-transactions — fire-and-forget ledger ingest.
 */
export async function recordAppTransaction(
  payload: RecordAppTransactionPayload
): Promise<boolean> {
  if (!BASE_URL) {
    if (__DEV__) {
      console.warn("[appTransactions] EXPO_PUBLIC_API_URL not set; skipping record");
    }
    return false;
  }

  const body = enrichPayload(payload);
  if (!body.wallet_address) {
    if (__DEV__) {
      console.warn("[appTransactions] no wallet_address; skipping record");
    }
    return false;
  }

  try {
    const res = await fetch(`${BASE_URL}/v2/app-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      if (__DEV__) {
        console.warn("[appTransactions] record failed", res.status, errBody);
      }
      return false;
    }

    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn("[appTransactions] network error", e);
    }
    return false;
  }
}

/** Non-blocking wrapper for use after on-chain success. */
export function recordAppTransactionAsync(
  payload: RecordAppTransactionPayload
): void {
  void recordAppTransaction(payload);
}

function appTransactionQuery(params?: { limit?: number }) {
  const wallet = WalletItem.getState().publicKey?.toString() ?? "";
  const query = new URLSearchParams({
    wallet_address: wallet,
    cluster: currentCluster(),
  });
  if (params?.limit) {
    query.set("limit", String(params.limit));
  }
  return { wallet, query };
}

export async function getAppTransactions(options?: {
  limit?: number;
}): Promise<AppTransactionResponse<AppTransaction[]>> {
  if (!BASE_URL) {
    return { status: false, message: "API URL is not configured" };
  }

  const { wallet, query } = appTransactionQuery({ limit: options?.limit ?? 50 });
  if (!wallet) {
    return { status: false, message: "Wallet not connected" };
  }

  try {
    const res = await fetch(`${BASE_URL}/v2/app-transactions?${query.toString()}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.success) {
      return {
        status: false,
        message: body?.message ?? "Unable to load transactions",
      };
    }

    return {
      status: true,
      data: Array.isArray(body.data) ? body.data : [],
    };
  } catch (e) {
    return {
      status: false,
      message: e instanceof Error ? e.message : "Unable to load transactions",
    };
  }
}

export async function getAppTransaction(
  id: string | number
): Promise<AppTransactionResponse<AppTransaction>> {
  if (!BASE_URL) {
    return { status: false, message: "API URL is not configured" };
  }

  const { wallet, query } = appTransactionQuery();
  if (!wallet) {
    return { status: false, message: "Wallet not connected" };
  }

  try {
    const res = await fetch(
      `${BASE_URL}/v2/app-transactions/${id}?${query.toString()}`
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.success || !body?.data) {
      return {
        status: false,
        message: body?.message ?? "Unable to load transaction",
      };
    }

    return { status: true, data: body.data };
  } catch (e) {
    return {
      status: false,
      message: e instanceof Error ? e.message : "Unable to load transaction",
    };
  }
}

export function estimateUsdFromWalletToken(
  mint: string | undefined,
  amount: number
): number | undefined {
  if (!mint || !Number.isFinite(amount) || amount <= 0) return undefined;

  const token = UserItem.getState().userWallet.tokenAccounts.find(
    (t) => t.mint === mint
  );
  if (!token || !token.balance || token.balance <= 0) return undefined;

  const usdcPerToken =
    (token as { usdc_price?: number }).usdc_price != null
      ? (token as { usdc_price: number }).usdc_price / token.balance
      : undefined;

  if (!usdcPerToken || !Number.isFinite(usdcPerToken)) return undefined;
  return amount * usdcPerToken;
}

export function recordSwapTransaction(params: {
  signature: string;
  inputMint: string;
  inputSymbol: string;
  inputAmount: number;
  outputMint: string;
  outputSymbol: string;
  outputAmount: number;
  platformFeeBps?: number;
  provider?: string;
  app_called?: string;
  input_amount_usd?: number;
  output_amount_usd?: number;
  status?: AppTransactionStatus;
}): void {
  const platformFeeAmount =
    params.platformFeeBps && params.platformFeeBps >= 50
      ? (params.inputAmount * params.platformFeeBps) / 10_000
      : undefined;

  const inputUsd =
    params.input_amount_usd ??
    estimateUsdFromWalletToken(params.inputMint, params.inputAmount);

  const outputUsd =
    params.output_amount_usd ??
    estimateUsdFromWalletToken(params.outputMint, params.outputAmount);

  const platformFeeUsd =
    platformFeeAmount != null && inputUsd != null && params.inputAmount > 0
      ? (platformFeeAmount / params.inputAmount) * inputUsd
      : undefined;

  recordAppTransactionAsync({
    signature: params.signature,
    transaction_type: "swap",
    status: params.status ?? "confirmed",
    provider: params.provider ?? "jupiter",
    app_called: params.app_called ?? "HeySolana",
    input_token_mint: params.inputMint,
    input_token_symbol: params.inputSymbol,
    input_amount: params.inputAmount,
    input_amount_usd: inputUsd,
    output_token_mint: params.outputMint,
    output_token_symbol: params.outputSymbol,
    output_amount: params.outputAmount,
    output_amount_usd: outputUsd,
    platform_fee_amount: platformFeeAmount,
    platform_fee_token: platformFeeAmount ? params.inputSymbol : undefined,
    platform_fee_usd: platformFeeUsd,
    amount: params.inputAmount,
    token: params.inputSymbol,
    raw_metadata: {
      platform_fee_bps: params.platformFeeBps ?? 0,
    },
  });
}

export function recordTransferTransaction(params: {
  signature: string;
  mint?: string;
  symbol: string;
  amount: number;
  recipient: string;
  provider?: string;
  app_called?: string;
  input_amount_usd?: number;
  status?: AppTransactionStatus;
}): void {
  const isSol = !params.mint || params.symbol.toUpperCase() === "SOL";
  const inputUsd =
    params.input_amount_usd ??
    (params.mint
      ? estimateUsdFromWalletToken(params.mint, params.amount)
      : estimateUsdFromWalletToken(
          "So11111111111111111111111111111111111111112",
          params.amount
        ));

  recordAppTransactionAsync({
    signature: params.signature,
    transaction_type: "transfer",
    status: params.status ?? "confirmed",
    provider: params.provider ?? "native",
    app_called: params.app_called ?? "HeySolana",
    input_token_mint: isSol
      ? "So11111111111111111111111111111111111111112"
      : params.mint,
    input_token_symbol: params.symbol,
    input_amount: params.amount,
    input_amount_usd: inputUsd,
    recipient_address: params.recipient,
    amount: params.amount,
    token: params.symbol,
  });
}

export function recordCommercePaymentTransaction(params: {
  signature: string;
  provider: string;
  app_called: string;
  amount: number;
  token?: string;
  mint?: string;
  recipient: string;
  order_reference?: string;
  product_reference?: string;
  input_amount_usd?: number;
  raw_metadata?: Record<string, unknown>;
}): void {
  recordAppTransactionAsync({
    signature: params.signature,
    transaction_type: "commerce",
    status: "confirmed",
    provider: params.provider,
    app_called: params.app_called,
    input_token_mint: params.mint,
    input_token_symbol: params.token ?? "USDC",
    input_amount: params.amount,
    input_amount_usd:
      params.input_amount_usd ??
      estimateUsdFromWalletToken(params.mint, params.amount) ??
      (params.token?.toUpperCase() === "USDC" ? params.amount : undefined),
    recipient_address: params.recipient,
    amount: params.amount,
    token: params.token ?? "USDC",
    raw_metadata: {
      order_reference: params.order_reference,
      product_reference: params.product_reference,
      ...(params.raw_metadata ?? {}),
    },
  });
}

export function recordDepositTransaction(params: {
  client_reference?: string;
  signature?: string;
  provider: string;
  app_called?: string;
  amount: number;
  token: string;
  mint?: string;
  recipient?: string;
  input_amount_usd?: number;
  status?: AppTransactionStatus;
  raw_metadata?: Record<string, unknown>;
}): void {
  recordAppTransactionAsync({
    client_reference: params.client_reference,
    signature: params.signature,
    transaction_type: "deposit",
    status: params.status ?? "confirmed",
    provider: params.provider,
    app_called: params.app_called ?? params.provider,
    input_token_mint: params.mint,
    input_token_symbol: params.token,
    input_amount: params.amount,
    input_amount_usd:
      params.input_amount_usd ??
      resolveInputAmountUsd({
        amount: params.amount,
        token: params.token,
        mint: params.mint,
      }),
    recipient_address: params.recipient,
    amount: params.amount,
    token: params.token,
    raw_metadata: params.raw_metadata,
  });
}

export function recordOfframpTransaction(params: {
  signature: string;
  provider: string;
  app_called?: string;
  amount: number;
  token: string;
  mint?: string;
  recipient: string;
  input_amount_usd?: number;
  raw_metadata?: Record<string, unknown>;
}): void {
  recordAppTransactionAsync({
    signature: params.signature,
    transaction_type: "offramp",
    status: "confirmed",
    provider: params.provider,
    app_called: params.app_called ?? params.provider,
    input_token_mint: params.mint,
    input_token_symbol: params.token,
    input_amount: params.amount,
    input_amount_usd:
      params.input_amount_usd ??
      estimateUsdFromWalletToken(params.mint, params.amount),
    recipient_address: params.recipient,
    amount: params.amount,
    token: params.token,
    raw_metadata: params.raw_metadata,
  });
}
