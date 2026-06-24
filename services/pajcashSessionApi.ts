import { BASE_URL } from "@/utils/constant";
import UserItem from "@/utils/store/userstore.store";
import { phoneForPushApi } from "@/utils/phone/phoneE164";
import { resolveWalletAddress } from "@/utils/wallet/resolveWalletAddress";

export type PajCashSessionPayload = {
  recipient: string;
  token: string;
  expiresAt: string | null;
};

type ApiSession = {
  recipient: string;
  token: string;
  expires_at?: string | null;
};

function sessionIdentityParams(walletAddress?: string): Record<string, string> {
  const wallet = walletAddress || resolveWalletAddress();
  const phone = phoneForPushApi(UserItem.getState().user);
  const params: Record<string, string> = {};
  if (wallet) params.wallet_address = wallet;
  if (phone) params.phone_number = phone;
  return params;
}

function toSessionPayload(item: ApiSession): PajCashSessionPayload {
  return {
    recipient: item.recipient,
    token: item.token,
    expiresAt: item.expires_at ?? null,
  };
}

function isSessionExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return exp <= Date.now();
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return (
    (data as { message?: string; error?: string })?.message ||
    (data as { error?: string })?.error ||
    fallback
  );
}

export async function getPajCashSession(
  walletAddress?: string
): Promise<PajCashSessionPayload | null> {
  if (!BASE_URL) return null;
  const params = sessionIdentityParams(walletAddress);
  if (!params.wallet_address && !params.phone_number) return null;

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/pajcash/wallet/session?${query}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to load PajCash session"));
  }
  const json = (await res.json()) as { data?: ApiSession | null };
  if (!json.data?.token) return null;
  const payload = toSessionPayload(json.data);
  if (isSessionExpired(payload.expiresAt)) return null;
  return payload;
}

export async function savePajCashSession(
  session: PajCashSessionPayload,
  walletAddress?: string
): Promise<void> {
  if (!BASE_URL) return;
  const identity = sessionIdentityParams(walletAddress);
  if (!identity.wallet_address && !identity.phone_number) return;

  const res = await fetch(`${BASE_URL}/pajcash/wallet/session`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      recipient: session.recipient,
      token: session.token,
      expires_at: session.expiresAt,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to save PajCash session"));
  }
}

export async function clearPajCashSession(walletAddress?: string): Promise<void> {
  if (!BASE_URL) return;
  const params = sessionIdentityParams(walletAddress);
  if (!params.wallet_address && !params.phone_number) return;

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/pajcash/wallet/session?${query}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to clear PajCash session"));
  }
}
