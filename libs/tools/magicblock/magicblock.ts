/**
 * MagicBlock Private Payments REST client.
 *
 * Wraps https://payments.magicblock.app — a stateless transaction-builder service
 * that returns unsigned base64 SPL transactions for deposit / transfer / withdraw
 * across the Solana base chain and MagicBlock's ephemeral rollup.
 *
 * Reference: payments.magicblock.app/reference
 */

const MB_BASE = process.env.EXPO_PUBLIC_MAGICBLOCK_API || "https://payments.magicblock.app";

export type MbCluster = "mainnet" | "devnet";
export type MbVisibility = "public" | "private";
export type MbBalanceLocation = "base" | "ephemeral";
export type MbTxVersion = "legacy" | "v0";

export interface MbBuiltTx {
  kind: "deposit" | "transfer" | "withdraw" | string;
  version: MbTxVersion;
  transactionBase64: string;
  sendTo: MbBalanceLocation;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  instructionCount: number;
  requiredSigners: string[];
  validator?: string;
}

export interface MbBalance {
  address: string;
  mint: string;
  ata: string;
  location: MbBalanceLocation;
  balance: string;
}

export interface MbDepositPayload {
  owner: string;
  amount: number;
  cluster?: MbCluster;
  mint?: string;
  validator?: string;
  initIfMissing?: boolean;
  initVaultIfMissing?: boolean;
  initAtasIfMissing?: boolean;
  idempotent?: boolean;
}

export interface MbTransferPayload {
  from: string;
  to: string;
  mint: string;
  amount: number;
  visibility: MbVisibility;
  fromBalance: MbBalanceLocation;
  toBalance: MbBalanceLocation;
  cluster?: MbCluster;
  validator?: string;
  initIfMissing?: boolean;
  initAtasIfMissing?: boolean;
  initVaultIfMissing?: boolean;
  memo?: string;
  /** ms, decimal string */
  minDelayMs?: string;
  /** ms, decimal string */
  maxDelayMs?: string;
  /** decimal string u64 */
  clientRefId?: string;
  /** 1..15 (must not exceed amount) */
  split?: number;
  gasless?: boolean;
  legacy?: boolean;
}

export interface MbWithdrawPayload {
  owner: string;
  mint: string;
  amount: number;
  cluster?: MbCluster;
  validator?: string;
  initIfMissing?: boolean;
  initAtasIfMissing?: boolean;
  escrowIndex?: number;
  idempotent?: boolean;
}

export type MbResult<T> =
  | { status: true; data: T }
  | { status: false; message: string; httpStatus?: number };

const safeJson = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const toErrorMessage = (body: any, fallback: string) => {
  if (body && typeof body === "object") {
    if (typeof body.error === "string" && body.error.trim()) return body.error;
    if (typeof body.message === "string" && body.message.trim()) return body.message;
  }
  return fallback;
};

const get = async <T,>(path: string, headers?: Record<string, string>): Promise<MbResult<T>> => {
  try {
    const response = await fetch(`${MB_BASE}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", ...(headers ?? {}) },
    });
    const body = await safeJson(response);
    if (!response.ok) {
      return {
        status: false,
        message: toErrorMessage(body, `Request failed (${response.status})`),
        httpStatus: response.status,
      };
    }
    return { status: true, data: body as T };
  } catch (error) {
    return {
      status: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

const postJson = async <T,>(
  path: string,
  body: any,
  headers?: Record<string, string>
): Promise<MbResult<T>> => {
  try {
    const response = await fetch(`${MB_BASE}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: JSON.stringify(body),
    });
    const respBody = await safeJson(response);
    if (!response.ok) {
      return {
        status: false,
        message: toErrorMessage(respBody, `Request failed (${response.status})`),
        httpStatus: response.status,
      };
    }
    return { status: true, data: respBody as T };
  } catch (error) {
    return {
      status: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

const buildBearer = (token?: string | null) =>
  token ? { Authorization: `Bearer ${token}` } : undefined;

export const magicblock = {
  baseUrl: MB_BASE,

  health: () => get<{ status: "ok" }>("/health"),

  challenge: (pubkey: string, cluster: MbCluster = "mainnet", mock = false) =>
    get<{ challenge: string }>(
      `/v1/spl/challenge?pubkey=${encodeURIComponent(pubkey)}&cluster=${cluster}${mock ? "&mock=true" : ""}`
    ),

  login: (body: {
    pubkey: string;
    challenge: string;
    signature: string;
    cluster?: MbCluster;
    mock?: boolean;
  }) => postJson<{ token: string }>("/v1/spl/login", body),

  deposit: (body: MbDepositPayload) => postJson<MbBuiltTx>("/v1/spl/deposit", body),

  transfer: (body: MbTransferPayload, token?: string | null) =>
    postJson<MbBuiltTx>("/v1/spl/transfer", body, buildBearer(token)),

  withdraw: (body: MbWithdrawPayload) => postJson<MbBuiltTx>("/v1/spl/withdraw", body),

  initMint: (body: { mint: string; owner: string; cluster?: MbCluster; validator?: string }) =>
    postJson<MbBuiltTx>("/v1/spl/init-mint", body),

  isMintInitialized: (mint: string, cluster: MbCluster = "mainnet") =>
    get<{ initialized: boolean; mint: string }>(
      `/v1/spl/is-mint-initialized?mint=${encodeURIComponent(mint)}&cluster=${cluster}`
    ),

  balance: (address: string, mint: string, cluster: MbCluster = "mainnet") =>
    get<MbBalance>(
      `/v1/spl/balance?address=${encodeURIComponent(address)}&mint=${encodeURIComponent(mint)}&cluster=${cluster}`
    ),

  privateBalance: (
    address: string,
    mint: string,
    token: string,
    cluster: MbCluster = "mainnet"
  ) =>
    get<MbBalance>(
      `/v1/spl/private-balance?address=${encodeURIComponent(address)}&mint=${encodeURIComponent(mint)}&cluster=${cluster}`,
      buildBearer(token)
    ),

  swapQuote: (params: {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
    swapMode?: "ExactIn" | "ExactOut";
    asLegacyTransaction?: boolean;
  }) => {
    const qs = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      ...(params.slippageBps != null ? { slippageBps: String(params.slippageBps) } : {}),
      ...(params.swapMode ? { swapMode: params.swapMode } : {}),
      ...(params.asLegacyTransaction != null
        ? { asLegacyTransaction: String(params.asLegacyTransaction) }
        : {}),
    });
    return get<any>(`/v1/swap/quote?${qs.toString()}`);
  },

  swap: (body: any) =>
    postJson<{
      swapTransaction: string;
      lastValidBlockHeight?: number;
      prioritizationFeeLamports?: number;
      privateTransfer?: { stashAta: string; hydraCrankPda: string; shuttleId: number };
    }>("/v1/swap/swap", body),
};

export const MAGICBLOCK_DEFAULTS = {
  USDC_MAINNET: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDC_DEVNET: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  VALIDATOR: "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
};

export const defaultUsdcMint = (cluster: MbCluster) =>
  cluster === "devnet" ? MAGICBLOCK_DEFAULTS.USDC_DEVNET : MAGICBLOCK_DEFAULTS.USDC_MAINNET;
