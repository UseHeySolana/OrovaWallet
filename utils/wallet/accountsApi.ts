import { BASE_URL } from "@/utils/constant";

export type WalletTypeCatalogItem = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  icon_url?: string | null;
  category: "crypto" | "fiat";
  network?: string | null;
  provider?: string;
  provider_config?: Record<string, unknown> | null;
  allows_multiple?: boolean;
  sort_order?: number;
  kyc_requirements?: KycRequirement[];
};

export type KycRequirement = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  field_kind: "text" | "number" | "date" | "select" | "image" | "document";
  validation?: Record<string, unknown> | null;
  example_image_url?: string | null;
  provider_key?: string | null;
  required?: boolean;
  sort_order?: number;
};

export type UserWalletAccount = {
  id: number;
  wallet_type_id: number;
  type_slug?: string;
  type_name?: string;
  category?: string;
  status: string;
  address?: string | null;
  display_meta?: Record<string, unknown> | null;
  available_balance?: string | number | null;
  pending_balance?: string | number | null;
  is_primary?: boolean;
};

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchActiveWalletTypes(): Promise<WalletTypeCatalogItem[]> {
  const res = await fetch(`${BASE_URL}/v2/wallet-types`);
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.message || "Failed to load wallet types");
  }
  return data.wallet_types || [];
}

export async function fetchWalletTypeDetail(
  slug: string
): Promise<WalletTypeCatalogItem> {
  const res = await fetch(`${BASE_URL}/v2/wallet-types/${encodeURIComponent(slug)}`);
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.message || "Failed to load wallet type");
  }
  return data.wallet_type;
}

export async function fetchUserWallets(
  username: string
): Promise<UserWalletAccount[]> {
  const res = await fetch(
    `${BASE_URL}/v2/wallets?username=${encodeURIComponent(username)}`
  );
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.message || "Failed to load wallets");
  }
  return data.wallets || [];
}

export async function createUserWallet(payload: {
  username: string;
  wallet_type_slug: string;
  address?: string;
  label?: string;
}): Promise<UserWalletAccount> {
  const res = await fetch(`${BASE_URL}/v2/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok && res.status !== 409) {
    throw new Error(data.message || "Failed to create wallet");
  }
  return data.wallet;
}

export async function submitWalletKyc(payload: {
  username: string;
  walletId: number;
  fields: Record<string, string>;
  files?: Record<string, { uri: string; name: string; type: string }>;
}): Promise<UserWalletAccount> {
  const form = new FormData();
  form.append("username", payload.username);
  form.append("fields", JSON.stringify(payload.fields));
  for (const [slug, value] of Object.entries(payload.fields)) {
    form.append(`field_${slug}`, value);
  }
  if (payload.files) {
    for (const [slug, file] of Object.entries(payload.files)) {
      form.append(`file_${slug}`, file as any);
    }
  }

  const res = await fetch(`${BASE_URL}/v2/wallets/${payload.walletId}/kyc`, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "multipart/form-data",
    },
    body: form,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.message || "Failed to submit KYC");
  }
  return data.wallet;
}
