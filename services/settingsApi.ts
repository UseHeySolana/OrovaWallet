import { BASE_URL } from "@/utils/constant";

export interface PublicSettings {
  treasury_wallet_address: string;
  /** Delivery fee in NGN (Jumia). Shown as part of total item price. */
  delivery_fee_jumia_ngn: number;
  /** Delivery fee in USD (Crossmint/Amazon). Shown as part of total item price. */
  delivery_fee_crossmint_usd: number;
}

/**
 * Fetch public settings (no auth). Used for treasury wallet and delivery fees (Jumia, Crossmint).
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  const res = await fetch(BASE_URL + "/settings/public", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to fetch settings");
  }
  const d = (data as { data?: { treasury_wallet_address?: string; delivery_fee_jumia_ngn?: number; delivery_fee_crossmint_usd?: number } }).data;
  return {
    treasury_wallet_address: (d?.treasury_wallet_address ?? "").trim(),
    delivery_fee_jumia_ngn: Number(d?.delivery_fee_jumia_ngn ?? 0) || 0,
    delivery_fee_crossmint_usd: Number(d?.delivery_fee_crossmint_usd ?? 0) || 0,
  };
}
