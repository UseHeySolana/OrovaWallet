import { BASE_URL } from "@/utils/constant";

interface KalshiStatusResponse {
  is_active: boolean;
  has_private_key: boolean;
  has_access_key_id: boolean;
  environment: "production" | "staging" | null;
  key_label: string | null;
  public_key: string | null;
  private_key_fingerprint: string | null;
  api_key_backed_up_at: string | null;
}

type QueryValue = string | number | boolean | undefined | null;
export interface KalshiIdentityPayload {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
}

async function postJson(path: string, payload: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "Request failed");
  }
  return data as any;
}

async function getJson(path: string, query: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });
  const url = `${BASE_URL}${path}${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "Request failed");
  }
  return data as any;
}

export async function activateKalshiWallet(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  private_key: string;
  kalshi_access_key_id: string;
  key_label?: string;
  environment?: "production" | "staging";
}) {
  return postJson("/kalshi/wallet/activate", payload);
}

export async function backupKalshiApiKey(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  kalshi_access_key_id: string;
}) {
  return postJson("/kalshi/wallet/backup-api-key", payload);
}

export async function getKalshiWalletStatus(identity: KalshiIdentityPayload): Promise<KalshiStatusResponse> {
  const params = new URLSearchParams();
  if (identity.user_id != null) params.append("user_id", String(identity.user_id));
  if (identity.phone_number) params.append("phone_number", identity.phone_number);
  if (identity.wallet_address) params.append("wallet_address", identity.wallet_address);
  const res = await fetch(
    `${BASE_URL}/kalshi/wallet/status?${params.toString()}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "Failed to fetch Kalshi status");
  }
  return ((data as { data?: KalshiStatusResponse }).data || {
    is_active: false,
    has_private_key: false,
    has_access_key_id: false,
    environment: null,
    key_label: null,
    public_key: null,
    private_key_fingerprint: null,
    api_key_backed_up_at: null,
  }) as KalshiStatusResponse;
}

export async function searchKalshiEvents(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  status?: string;
  series_ticker?: string;
  limit?: number;
  cursor?: string;
  with_nested_markets?: boolean;
}) {
  return getJson("/kalshi/trade/events", payload);
}

export async function searchKalshiMarkets(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  status?: string;
  event_ticker?: string;
  series_ticker?: string;
  tickers?: string;
  limit?: number;
  cursor?: string;
}) {
  return getJson("/kalshi/trade/markets", payload);
}

export async function getKalshiMarket(payload: { user_id?: number; phone_number?: string; wallet_address?: string; ticker: string }) {
  return getJson(`/kalshi/trade/markets/${encodeURIComponent(payload.ticker)}`, {
    wallet_address: payload.wallet_address,
  });
}

export async function getKalshiOrderbook(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  ticker: string;
  depth?: number;
}) {
  return getJson(`/kalshi/trade/markets/${encodeURIComponent(payload.ticker)}/orderbook`, {
    wallet_address: payload.wallet_address,
    depth: payload.depth,
  });
}

export async function getKalshiCandlesticks(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  market_tickers: string;
  start_ts: number;
  end_ts: number;
  period_interval: number;
  include_latest_before_start?: boolean;
}) {
  return getJson("/kalshi/trade/markets/candlesticks", payload);
}

export async function placeKalshiOrder(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  order: Record<string, unknown>;
}) {
  return postJson("/kalshi/trade/portfolio/orders", payload);
}

export async function cancelKalshiOrder(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  order_id: string;
}) {
  const params = new URLSearchParams();
  if (payload.user_id != null) params.append("user_id", String(payload.user_id));
  if (payload.phone_number) params.append("phone_number", payload.phone_number);
  if (payload.wallet_address) params.append("wallet_address", payload.wallet_address);
  const res = await fetch(
    `${BASE_URL}/kalshi/trade/portfolio/orders/${encodeURIComponent(payload.order_id)}?${params.toString()}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "Cancel request failed");
  }
  return data as any;
}

export async function getKalshiPortfolioOrders(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  ticker?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}) {
  return getJson("/kalshi/trade/portfolio/orders", payload);
}

export async function getKalshiPositions(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  ticker?: string;
  event_ticker?: string;
  limit?: number;
  cursor?: string;
}) {
  return getJson("/kalshi/trade/portfolio/positions", payload);
}

