import { BASE_URL } from "@/utils/constant";

export interface PublicSettings {
  /** Treasury wallet address set by admin in the backend; all purchases and fees are sent here. */
  treasury_wallet_address: string;
  /** Delivery fee in NGN (Jumia). Shown as part of total item price. */
  delivery_fee_jumia_ngn: number;
  /** Fallback delivery fee in NGN (Chowdeck) when vendor delivery price is unavailable. */
  delivery_fee_chowdeck_ngn: number;
  /** Delivery fee in USD (Crossmint/Amazon). Shown as part of total item price. */
  delivery_fee_crossmint_usd: number;
  /** Jupiter referral account for swap integrator fees (admin-configured). */
  jupiter_referral_account: string;
  /** Swap fee in basis points (50–255). 0 = disabled. */
  jupiter_referral_fee_bps: number;
  /** PajCash onramp integrator fee in USDC (businessUSDCFee). 0 = disabled. */
  pajcash_onramp_usdc_fee: number;
  /** PajCash offramp integrator fee in USDC (businessUSDCFee). 0 = disabled. */
  pajcash_offramp_usdc_fee: number;
}

/**
 * Fetch public settings (no auth). Treasury is set by admin in the backend; app uses it for all USDC payments (Jumia, Crossmint).
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
  const d = (data as {
    data?: {
      treasury_wallet_address?: string;
      delivery_fee_jumia_ngn?: number;
      delivery_fee_chowdeck_ngn?: number;
      delivery_fee_crossmint_usd?: number;
      jupiter_referral_account?: string;
      jupiter_referral_fee_bps?: number;
      pajcash_onramp_usdc_fee?: number;
      pajcash_offramp_usdc_fee?: number;
    };
  }).data;
  return {
    treasury_wallet_address: (d?.treasury_wallet_address ?? "").trim(),
    delivery_fee_jumia_ngn: Number(d?.delivery_fee_jumia_ngn ?? 0) || 0,
    delivery_fee_chowdeck_ngn: Number(d?.delivery_fee_chowdeck_ngn ?? 0) || 0,
    delivery_fee_crossmint_usd: Number(d?.delivery_fee_crossmint_usd ?? 0) || 0,
    jupiter_referral_account: (d?.jupiter_referral_account ?? "").trim(),
    jupiter_referral_fee_bps: Number(d?.jupiter_referral_fee_bps ?? 0) || 0,
    pajcash_onramp_usdc_fee: Number(d?.pajcash_onramp_usdc_fee ?? 0) || 0,
    pajcash_offramp_usdc_fee: Number(d?.pajcash_offramp_usdc_fee ?? 0) || 0,
  };
}
