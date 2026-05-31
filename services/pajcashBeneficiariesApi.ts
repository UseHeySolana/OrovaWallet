import { BASE_URL } from "@/utils/constant";
import type { PajCashBeneficiary } from "@/utils/store/pajcashBeneficiaries.store";

type ApiBeneficiary = {
  id: number;
  bank_id: string;
  bank_name: string;
  bank_code?: string | null;
  account_number: string;
  account_name: string;
  updated_at?: string;
};

function toBeneficiary(item: ApiBeneficiary): PajCashBeneficiary {
  return {
    id: `${item.bank_id}:${item.account_number}`,
    backendId: item.id,
    bankId: item.bank_id,
    bankName: item.bank_name,
    bankCode: item.bank_code ?? undefined,
    accountNumber: item.account_number,
    accountName: item.account_name,
    updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
  };
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return (
    (data as { message?: string; error?: string })?.message ||
    (data as { error?: string })?.error ||
    fallback
  );
}

export async function getPajCashBeneficiaries(
  walletAddress: string
): Promise<PajCashBeneficiary[]> {
  if (!BASE_URL) return [];
  const res = await fetch(
    `${BASE_URL}/pajcash/wallet/beneficiaries?wallet_address=${encodeURIComponent(walletAddress)}`,
    { method: "GET", headers: { "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to load beneficiaries"));
  }
  const json = (await res.json()) as { data?: ApiBeneficiary[] };
  return (json.data ?? []).map(toBeneficiary);
}

export async function savePajCashBeneficiary(
  walletAddress: string,
  beneficiary: Omit<PajCashBeneficiary, "id" | "updatedAt" | "backendId">
): Promise<PajCashBeneficiary> {
  if (!BASE_URL) {
    throw new Error("API URL is not configured");
  }
  const res = await fetch(`${BASE_URL}/pajcash/wallet/beneficiaries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: walletAddress,
      bank_id: beneficiary.bankId,
      bank_name: beneficiary.bankName,
      bank_code: beneficiary.bankCode,
      account_number: beneficiary.accountNumber,
      account_name: beneficiary.accountName,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (json as { message?: string; error?: string })?.message ||
        (json as { error?: string })?.error ||
        "Failed to save beneficiary"
    );
  }
  return toBeneficiary((json as { data: ApiBeneficiary }).data);
}

export async function deletePajCashBeneficiary(
  walletAddress: string,
  beneficiary: PajCashBeneficiary
): Promise<void> {
  if (!BASE_URL) return;
  const backendId = beneficiary.backendId ?? Number(beneficiary.id);
  if (!Number.isFinite(backendId)) return;

  const res = await fetch(
    `${BASE_URL}/pajcash/wallet/beneficiaries/${backendId}?wallet_address=${encodeURIComponent(walletAddress)}`,
    { method: "DELETE", headers: { "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to delete beneficiary"));
  }
}
