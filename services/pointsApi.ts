import { BASE_URL } from "@/utils/constant";

export interface HeyPointsQuickAmount {
  amount_ngn: number;
  cashback_points: number;
}

export interface HeyPointsConfig {
  enabled: boolean;
  cashback_enabled: boolean;
  cashback_percent: number;
  cashback_min_purchase_ngn: number;
  cashback_max_points_per_txn: number;
  cashback_earn_types?: Array<"airtime" | "internet">;
  redeem_airtime_enabled: boolean;
  redeem_gas_enabled: boolean;
  max_redeem_percent_airtime: number;
  lamports_per_point: number;
  quick_amounts: HeyPointsQuickAmount[];
}

export function calculateCashbackPointsFromConfig(
  config: HeyPointsConfig | null,
  purchaseAmountNgn: number
): number {
  if (!config?.enabled || !config.cashback_enabled || purchaseAmountNgn <= 0) {
    return 0;
  }
  if (purchaseAmountNgn < config.cashback_min_purchase_ngn) {
    return 0;
  }

  let points = Math.floor((purchaseAmountNgn * config.cashback_percent) / 100);
  if (config.cashback_max_points_per_txn > 0) {
    points = Math.min(points, config.cashback_max_points_per_txn);
  }
  return points;
}

export interface HeyPointsLedgerEntry {
  id: number;
  direction: "credit" | "debit";
  amount: number;
  balance_after: number;
  reason: string;
  reference_type?: string | null;
  reference_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface AirtimePointsRedemption {
  redemption_id: string;
  points_used: number;
  discount_ngn: number;
  usdc_due_ngn: number;
  balance: number;
  expires_at?: string;
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Request failed");
  }
  return data as T;
}

export async function getHeyPointsConfig(): Promise<HeyPointsConfig | null> {
  if (!BASE_URL) return null;
  try {
    const res = await fetch(`${BASE_URL}/points/config`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await parseJson<{ success: boolean; data: HeyPointsConfig }>(res);
    return data.data ?? null;
  } catch {
    return null;
  }
}

export async function getHeyPointsBalance(walletAddress: string): Promise<number> {
  if (!BASE_URL || !walletAddress) return 0;
  try {
    const res = await fetch(
      `${BASE_URL}/v2/points?wallet_address=${encodeURIComponent(walletAddress)}`,
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );
    const data = await parseJson<{ success: boolean; data: { balance: number } }>(res);
    return Number(data.data?.balance ?? 0) || 0;
  } catch {
    return 0;
  }
}

export async function getHeyPointsLedger(
  walletAddress: string,
  limit = 30
): Promise<{ balance: number; entries: HeyPointsLedgerEntry[] }> {
  if (!BASE_URL || !walletAddress) {
    return { balance: 0, entries: [] };
  }
  const res = await fetch(
    `${BASE_URL}/v2/points/ledger?wallet_address=${encodeURIComponent(walletAddress)}&limit=${limit}`,
    { method: "GET", headers: { "Content-Type": "application/json" } }
  );
  const data = await parseJson<{
    success: boolean;
    data: { balance: number; entries: HeyPointsLedgerEntry[] };
  }>(res);
  return {
    balance: Number(data.data?.balance ?? 0) || 0,
    entries: data.data?.entries ?? [],
  };
}

export function maxPointsForAirtimePurchase(
  config: HeyPointsConfig | null,
  balance: number,
  airtimeAmountNgn: number
): number {
  if (!config?.enabled || !config.redeem_airtime_enabled || balance <= 0) {
    return 0;
  }

  const percentCap = Math.floor(
    (airtimeAmountNgn * config.max_redeem_percent_airtime) / 100
  );
  const minUsdcDue = 50;
  const minDueCap =
    airtimeAmountNgn > minUsdcDue ? airtimeAmountNgn - minUsdcDue : 0;

  return Math.max(0, Math.min(balance, percentCap, minDueCap, airtimeAmountNgn));
}

export async function redeemHeyPointsForAirtime(params: {
  walletAddress: string;
  points: number;
  airtimeAmountNgn: number;
}): Promise<AirtimePointsRedemption> {
  const res = await fetch(`${BASE_URL}/v2/points/redeem/airtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: params.walletAddress,
      points: params.points,
      airtime_amount_ngn: params.airtimeAmountNgn,
    }),
  });
  const data = await parseJson<{ success: boolean; data: AirtimePointsRedemption }>(res);
  return data.data;
}

export async function cancelHeyPointsAirtimeRedemption(params: {
  walletAddress: string;
  redemptionId: string;
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/v2/points/redeem/airtime/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: params.walletAddress,
      redemption_id: params.redemptionId,
    }),
  });
  await parseJson(res);
}

export async function redeemHeyPointsForGas(params: {
  walletAddress: string;
  points: number;
}): Promise<{
  redemption_id: string;
  points_used: number;
  gas_lamports_est: number;
  balance: number;
}> {
  const res = await fetch(`${BASE_URL}/v2/points/redeem/gas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: params.walletAddress,
      points: params.points,
    }),
  });
  const data = await parseJson<{
    success: boolean;
    data: {
      redemption_id: string;
      points_used: number;
      gas_lamports_est: number;
      balance: number;
    };
  }>(res);
  return data.data;
}

export function formatPointsLabel(points: number) {
  return `${points.toLocaleString()} pt${points === 1 ? "" : "s"}`;
}
