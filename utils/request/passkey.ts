import { BASE_URL } from "@/utils/constant";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "react-native-passkeys/build/ReactNativePasskeys.types";

type ApiResult<T = unknown> =
  | { status: true; data: T }
  | { status: false; message: string };

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof json?.message === "string" ? json.message : "Request failed";
      const hint =
        response.status === 404 && message.includes("could not be found")
          ? " Passkey API is not on this server yet — use a local backend or deploy heysolanabackend."
          : "";
      return { status: false, message: message + hint };
    }
    return { status: true, data: json as T };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : "Request failed" };
  }
}

export async function fetchPasskeyRegisterOptions(
  walletAddress: string,
  username: string
): Promise<ApiResult<{ options: Record<string, unknown>; rp_id: string }>> {
  return postJson("/v2/passkey/register/options", {
    wallet_address: walletAddress,
    username,
  });
}

export async function verifyPasskeyRegistration(params: {
  walletAddress: string;
  username: string;
  credential: RegistrationResponseJSON;
}): Promise<ApiResult<{ ok: boolean }>> {
  return postJson("/v2/passkey/register/verify", {
    wallet_address: params.walletAddress,
    username: params.username,
    id: params.credential.id,
    raw_id: params.credential.rawId,
    client_data_json: params.credential.response.clientDataJSON,
    attestation_object: params.credential.response.attestationObject,
  });
}

export async function fetchPasskeyAuthOptions(
  walletAddress: string
): Promise<ApiResult<{ options: Record<string, unknown>; rp_id: string }>> {
  return postJson("/v2/passkey/auth/options", { wallet_address: walletAddress });
}

export async function verifyPasskeyAuth(params: {
  walletAddress: string;
  assertion: AuthenticationResponseJSON;
}): Promise<ApiResult<{ mpc_session_token: string; expires_in: number }>> {
  return postJson("/v2/passkey/auth/verify", {
    wallet_address: params.walletAddress,
    id: params.assertion.id,
    client_data_json: params.assertion.response.clientDataJSON,
    authenticator_data: params.assertion.response.authenticatorData,
    signature: params.assertion.response.signature,
    user_handle: params.assertion.response.userHandle,
  });
}
