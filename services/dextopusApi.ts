import { BASE_URL } from "@/utils/constant";

export const DEXTOPUS_SOLANA_CHAIN_ID = 792703809;
export const DEXTOPUS_NATIVE_SOL_ASSET = "11111111111111111111111111111111";
export const DEXTOPUS_USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface DextopusChain {
  chainId: number;
  name: string;
  solverCurrencies?: DextopusToken[];
  supportsStaticAddress?: boolean;
  nativeToken?: {
    symbol?: string;
    decimals?: number;
  };
}

export interface DextopusToken {
  chainId: number;
  address: string;
  symbol: string;
  name?: string;
  decimals?: number;
  logoUrl?: string;
  supportsStaticAddress?: boolean;
}

export interface DextopusDepositAddress {
  id: number;
  wallet_address: string;
  dextopus_address_id?: string | null;
  deposit_address: string;
  origin_chain_id: number;
  origin_asset: string;
  origin_symbol?: string | null;
  settlement_chain_id: number;
  settlement_asset: string;
  settlement_symbol?: string | null;
  settlement_address: string;
  refund_to?: string | null;
  created_at?: string | null;
}

export interface DextopusDeposit {
  id: number;
  wallet_address?: string | null;
  dextopus_deposit_id?: string | null;
  request_id?: string | null;
  deposit_address?: string | null;
  status: string;
  origin_chain_id?: number | null;
  origin_asset?: string | null;
  origin_amount?: string | null;
  origin_amount_formatted?: string | null;
  origin_amount_usd?: string | null;
  origin_tx_hash?: string | null;
  settlement_chain_id?: number | null;
  settlement_asset?: string | null;
  settlement_amount?: string | null;
  settlement_amount_formatted?: string | null;
  settlement_amount_usd?: string | null;
  settlement_tx_hash?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
}

export interface DextopusDestination {
  currency: string;
  symbol: string;
  blockchain?: string;
  destinationChainId: number;
  decimals?: number;
  addressKind?: string;
  supportsStaticAddress?: boolean;
  logoUrl?: string;
}

export interface DextopusQuoteResponse {
  success?: boolean;
  depositAddress?: string;
  requestId?: string;
  estimatedOutput?: string;
  estimatedTime?: string;
  expiresAt?: string;
  message?: string;
  error?: string;
}

async function parseJsonResponse<T>(res: Response, fallback: string): Promise<T> {
  const raw = await res.text();
  let data: unknown = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`${fallback}: server returned non-JSON response`);
  }

  if (!res.ok) {
    const message =
      (data as { message?: string; error?: string })?.message ||
      (data as { error?: string })?.error ||
      fallback;
    throw new Error(message);
  }

  return data as T;
}

async function getJson<T>(path: string, query?: Record<string, string | number | boolean>): Promise<T> {
  if (!BASE_URL) {
    throw new Error("API URL is not configured");
  }
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
      }
    });
  }
  const url = `${BASE_URL}${path}${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return parseJsonResponse<T>(res, "Request failed");
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  if (!BASE_URL) {
    throw new Error("API URL is not configured");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<T>(res, "Request failed");
}

export async function getDextopusChains(): Promise<DextopusChain[]> {
  const json = await getJson<{ chains?: DextopusChain[]; success?: boolean }>("/dextopus/chains");
  return json.chains ?? [];
}

export async function getDextopusTokens(
  chainId: number,
  supportsStaticAddress = true
): Promise<DextopusToken[]> {
  const json = await getJson<{
    chains?: DextopusChain[];
    tokens?: DextopusToken[];
  }>("/dextopus/tokens", {
    chain_id: chainId,
    supports_static_address: supportsStaticAddress,
  });

  const topLevelTokens = (json.tokens ?? [])
    .filter((token) => token.chainId === chainId)
    .filter((token) => !supportsStaticAddress || token.supportsStaticAddress !== false);

  if (topLevelTokens.length > 0) return topLevelTokens;

  const chain = (json.chains ?? []).find((item) => item.chainId === chainId);
  return (chain?.solverCurrencies ?? [])
    .map((token) => ({
      ...token,
      chainId,
      supportsStaticAddress: chain?.supportsStaticAddress ?? true,
    }))
    .filter((token) => !supportsStaticAddress || token.supportsStaticAddress !== false);
}

export async function getDextopusDestinations(
  originChainId: number,
  originAddress: string,
  supportsStaticAddress = true
): Promise<DextopusDestination[]> {
  const json = await getJson<{ destinations?: DextopusDestination[]; success?: boolean }>(
    "/dextopus/destinations",
    {
      origin_chain_id: originChainId,
      origin_address: originAddress,
      supports_static_address: supportsStaticAddress,
    }
  );
  return (json.destinations ?? []).filter(
    (item) => item.destinationChainId === DEXTOPUS_SOLANA_CHAIN_ID
  );
}

export async function createDextopusDepositAddress(payload: {
  wallet_address: string;
  origin_chain_id: number;
  origin_asset: string;
  origin_symbol?: string;
  settlement_asset: string;
  settlement_symbol?: string;
  settlement_address?: string;
  refund_to?: string;
}): Promise<DextopusDepositAddress> {
  const json = await postJson<{ data: DextopusDepositAddress }>("/dextopus/wallet/deposit-address", {
    wallet_address: payload.wallet_address,
    origin_chain_id: payload.origin_chain_id,
    origin_asset: payload.origin_asset,
    origin_symbol: payload.origin_symbol,
    settlement_chain_id: DEXTOPUS_SOLANA_CHAIN_ID,
    settlement_asset: payload.settlement_asset,
    settlement_symbol: payload.settlement_symbol,
    settlement_address: payload.settlement_address ?? payload.wallet_address,
    refund_to: payload.refund_to,
  });
  return json.data;
}

export async function listDextopusDepositAddresses(
  walletAddress: string
): Promise<DextopusDepositAddress[]> {
  const json = await getJson<{ data?: DextopusDepositAddress[] }>("/dextopus/wallet/deposit-addresses", {
    wallet_address: walletAddress,
  });
  return json.data ?? [];
}

export async function listDextopusDeposits(
  walletAddress: string,
  status?: string
): Promise<DextopusDeposit[]> {
  const json = await getJson<{ data?: DextopusDeposit[] }>("/dextopus/wallet/deposits", {
    wallet_address: walletAddress,
    ...(status ? { status } : {}),
  });
  return json.data ?? [];
}

export async function createDextopusQuote(payload: {
  wallet_address: string;
  origin_chain_id: number;
  destination_chain_id: number;
  origin_asset: string;
  destination_asset: string;
  amount: string;
  recipient?: string;
  refund_to?: string;
  dry?: boolean;
}): Promise<DextopusQuoteResponse> {
  return postJson<DextopusQuoteResponse>("/dextopus/quote", payload);
}
