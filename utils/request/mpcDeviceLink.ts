import { BASE_URL } from "@/utils/constant";

type ApiResult<T = unknown> =
  | { status: true; data: T }
  | { status: false; message: string };

async function postJson<T>(path: string, body: Record<string, unknown>, token?: string): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-Mpc-Session-Token"] = token;
    }
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        status: false,
        message: typeof json?.message === "string" ? json.message : "Request failed",
      };
    }
    return { status: true, data: json as T };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : "Request failed" };
  }
}

export async function requestDeviceLink(params: {
  username: string;
  walletAddress: string;
  newDevicePublicKeyBase64: string;
}) {
  return postJson<{
    link_id: string;
    link_code: string;
    qr_payload: string;
    wallet_address: string;
    expires_at: string;
  }>("/v2/mpc/link/request", {
    wallet_address: params.walletAddress,
    username: params.username,
    new_device_public_key: params.newDevicePublicKeyBase64,
  });
}

export async function pollDeviceLinkStatus(linkId: string) {
  return postJson<{
    status: string;
    wallet_address?: string;
    encrypted_share_a?: string;
    mpc_session_token?: string;
  }>("/v2/mpc/link/status", { link_id: linkId });
}

export async function lookupDeviceLinkByCode(linkCode: string) {
  return postJson<{
    link_id: string;
    wallet_address: string;
    username: string;
    new_device_public_key: string;
  }>("/v2/mpc/link/lookup-code", { link_code: linkCode });
}

export async function approveDeviceLink(params: {
  linkId: string;
  encryptedShareA: string;
  mpcSessionToken: string;
}) {
  return postJson<{ ok: boolean }>(
    "/v2/mpc/link/approve",
    {
      link_id: params.linkId,
      encrypted_share_a: params.encryptedShareA,
    },
    params.mpcSessionToken
  );
}
