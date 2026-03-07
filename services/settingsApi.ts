import { BASE_URL } from "@/utils/constant";

export interface PublicSettings {
  treasury_wallet_address: string;
}

/**
 * Fetch public settings (no auth). Used for treasury wallet for all fees and payments (Jumia USDC, etc.).
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
  const d = (data as { data?: { treasury_wallet_address?: string } }).data;
  return {
    treasury_wallet_address: (d?.treasury_wallet_address ?? "").trim(),
  };
}
