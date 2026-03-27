import { BASE_URL } from "@/utils/constant";

type QueryValue = string | number | boolean | undefined | null;

export interface BayseIdentityPayload {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
}

interface BayseStatusResponse {
  is_active: boolean;
  has_public_key: boolean;
  has_secret_key: boolean;
  default_currency: "USD" | "NGN" | null;
  key_label: string | null;
  key_fingerprint: string | null;
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

export async function activateBayseWallet(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  public_key: string;
  secret_key: string;
  key_label?: string;
  default_currency?: "USD" | "NGN";
}) {
  return postJson("/bayse/wallet/activate", payload);
}

export async function getBayseWalletStatus(identity: BayseIdentityPayload): Promise<BayseStatusResponse> {
  const params = new URLSearchParams();
  if (identity.user_id != null) params.append("user_id", String(identity.user_id));
  if (identity.phone_number) params.append("phone_number", identity.phone_number);
  if (identity.wallet_address) params.append("wallet_address", identity.wallet_address);
  const res = await fetch(`${BASE_URL}/bayse/wallet/status?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "Failed to fetch Bayse status");
  }
  return ((data as { data?: BayseStatusResponse }).data || {
    is_active: false,
    has_public_key: false,
    has_secret_key: false,
    default_currency: null,
    key_label: null,
    key_fingerprint: null,
  }) as BayseStatusResponse;
}

export async function searchBayseEvents(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  keyword?: string;
  category?: string;
  status?: string;
  trending?: boolean;
  currency?: "USD" | "NGN";
  limit?: number;
  offset?: number;
}) {
  return getJson("/bayse/trade/events", payload);
}

export async function getBayseQuote(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  event_id: string;
  market_id: string;
  side: "BUY" | "SELL";
  outcome: string;
  amount: number;
  currency?: "USD" | "NGN";
}) {
  return postJson(`/bayse/trade/events/${encodeURIComponent(payload.event_id)}/markets/${encodeURIComponent(payload.market_id)}/quote`, {
    wallet_address: payload.wallet_address,
    phone_number: payload.phone_number,
    user_id: payload.user_id,
    order: {
      side: payload.side,
      outcome: payload.outcome,
      amount: payload.amount,
      currency: payload.currency || "USD",
    },
  });
}

export async function placeBayseOrder(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  event_id: string;
  market_id: string;
  order: Record<string, unknown>;
}) {
  return postJson(`/bayse/trade/events/${encodeURIComponent(payload.event_id)}/markets/${encodeURIComponent(payload.market_id)}/orders`, payload);
}

export async function cancelBayseOrder(payload: {
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
    `${BASE_URL}/bayse/trade/orders/${encodeURIComponent(payload.order_id)}?${params.toString()}`,
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

export async function getBaysePortfolio(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  currency?: "USD" | "NGN";
}) {
  return getJson("/bayse/trade/portfolio", payload);
}

export async function getBayseOrders(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return getJson("/bayse/trade/orders", payload);
}

export async function getBayseActivities(payload: {
  user_id?: number;
  phone_number?: string;
  wallet_address?: string;
  limit?: number;
  offset?: number;
}) {
  return getJson("/bayse/trade/activities", payload);
}

