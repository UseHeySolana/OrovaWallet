import { BASE_URL } from "@/utils/constant";
import type { PajCashBeneficiary } from "@/utils/store/pajcashBeneficiaries.store";
import UserItem from "@/utils/store/userstore.store";
import { phoneForPushApi } from "@/utils/phone/phoneE164";
import { resolveWalletAddress } from "@/utils/wallet/resolveWalletAddress";

type ApiBeneficiary = {
  id: number;
  bank_id: string;
  bank_name: string;
  bank_code?: string | null;
  account_number: string;
  account_name: string;
  updated_at?: string;
};

function beneficiaryIdentityParams(walletAddress?: string): Record<string, string> {
  const wallet = walletAddress || resolveWalletAddress();
  const phone = phoneForPushApi(UserItem.getState().user);
  const params: Record<string, string> = {};
  if (wallet) params.wallet_address = wallet;
  if (phone) params.phone_number = phone;
  return params;
}

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
  walletAddress?: string
): Promise<PajCashBeneficiary[]> {
  if (!BASE_URL) return [];
  const params = beneficiaryIdentityParams(walletAddress);
  if (!params.wallet_address && !params.phone_number) return [];

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/pajcash/wallet/beneficiaries?${query}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to load beneficiaries"));
  }
  const json = (await res.json()) as { data?: ApiBeneficiary[] };
  return (json.data ?? []).map(toBeneficiary);
}

export async function savePajCashBeneficiary(
  beneficiary: Omit<PajCashBeneficiary, "id" | "updatedAt" | "backendId">,
  walletAddress?: string
): Promise<PajCashBeneficiary> {
  if (!BASE_URL) {
    throw new Error("API URL is not configured");
  }
  const identity = beneficiaryIdentityParams(walletAddress);
  if (!identity.wallet_address && !identity.phone_number) {
    throw new Error("Wallet address or phone number is required");
  }

  const res = await fetch(`${BASE_URL}/pajcash/wallet/beneficiaries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
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
  beneficiary: PajCashBeneficiary,
  walletAddress?: string
): Promise<void> {
  if (!BASE_URL) return;
  const backendId = beneficiary.backendId ?? Number(beneficiary.id);
  if (!Number.isFinite(backendId)) return;

  const identity = beneficiaryIdentityParams(walletAddress);
  if (!identity.wallet_address && !identity.phone_number) return;

  const query = new URLSearchParams(identity).toString();
  const res = await fetch(
    `${BASE_URL}/pajcash/wallet/beneficiaries/${backendId}?${query}`,
    { method: "DELETE", headers: { "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to delete beneficiary"));
  }
}
