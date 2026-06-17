import { BASE_URL } from "@/utils/constant";

const PREFIX = "/sdk/qvac/wallet";

export interface QvacRouteJob {
  job_id: string;
  job_ticket: string;
  job_ticket_expires_at: string;
}

export interface QvacRoutedProvider {
  provider_public_key: string;
  price_points_per_output_token: number;
  max_concurrency: number;
}

export interface QvacRouteResponse {
  success: boolean;
  job?: QvacRouteJob;
  provider?: QvacRoutedProvider;
  message?: string;
}

export interface QvacProviderBalance {
  provider_public_key: string;
  points_balance: number;
  tokens_processed_out: number;
  price_points_per_output_token: number;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not set");
  }

  const res = await fetch(`${BASE_URL}${PREFIX}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    success?: boolean;
    message?: string;
  };

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `QVAC coordinator error (${res.status})`);
  }

  return data;
}

export async function registerQvacProvider(input: {
  wallet_address: string;
  provider_public_key: string;
  models: string[];
  max_concurrency?: number;
  price_points_per_output_token?: number;
}) {
  return postJson<{ success: boolean }>("/providers/register", input);
}

export async function heartbeatQvacProvider(input: {
  wallet_address: string;
  provider_public_key: string;
  is_active?: boolean;
}) {
  return postJson<{ success: boolean }>("/providers/heartbeat", input);
}

export async function routeQvacInference(input: {
  wallet_address: string;
  model: string;
  consumer_public_key?: string;
  max_output_tokens?: number;
}): Promise<QvacRouteResponse> {
  return postJson<QvacRouteResponse>("/route", input);
}

export async function submitQvacReceipt(input: {
  wallet_address: string;
  job_id: string;
  job_ticket: string;
  provider_public_key: string;
  tokens_in?: number;
  tokens_out: number;
  duration_ms?: number;
}) {
  return postJson<{ success: boolean; points_earned?: number }>(
    "/receipts/submit",
    input
  );
}

export async function fetchQvacProviderBalance(input: {
  wallet_address: string;
  provider_public_key: string;
}): Promise<{ success: boolean } & QvacProviderBalance> {
  return postJson<{ success: boolean } & QvacProviderBalance>(
    "/providers/balance",
    input
  );
}

export async function requestQvacWithdraw(input: {
  wallet_address: string;
  provider_public_key: string;
  points: number;
}) {
  return postJson<{ success: boolean }>("/withdraw", input);
}
