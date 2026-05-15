import { BASE_URL } from "@/utils/constant";

type ApiResult<T = unknown> =
  | { status: true; data: T }
  | { status: false; message: string };

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        status: false,
        message:
          typeof json?.message === "string"
            ? json.message
            : response.statusText || "Request failed",
      };
    }
    return { status: true, data: json as T };
  } catch (err) {
    return {
      status: false,
      message: err instanceof Error ? err.message : "Request failed",
    };
  }
}

export type MpcChallengeResponse = {
  challenge: string;
  expires_at?: string;
};

export async function fetchMpcUpgradeChallenge(
  walletAddress: string,
  username: string
): Promise<ApiResult<MpcChallengeResponse>> {
  return postJson<MpcChallengeResponse>("/v2/mpc/upgrade/challenge", {
    wallet_address: walletAddress,
    username,
  });
}

export async function verifyMpcUpgradeOwnership(params: {
  walletAddress: string;
  username: string;
  challenge: string;
  signature: string;
}): Promise<ApiResult<{ verified: boolean }>> {
  return postJson("/v2/mpc/upgrade/verify", {
    wallet_address: params.walletAddress,
    username: params.username,
    challenge: params.challenge,
    signature: params.signature,
  });
}

export async function completeMpcUpgrade(params: {
  walletAddress: string;
  username: string;
  shareBEncryptedBase64: string;
  shareAEncryptedBase64?: string;
  challenge: string;
  signature: string;
}): Promise<ApiResult<{ wallet_type: string; wallet_address: string }>> {
  return postJson("/v2/mpc/upgrade/complete", {
    wallet_address: params.walletAddress,
    username: params.username,
    share_b_encrypted: params.shareBEncryptedBase64,
    share_a_encrypted: params.shareAEncryptedBase64,
    challenge: params.challenge,
    signature: params.signature,
  });
}

export async function removeLocalMnemonicAfterUpgrade(params: {
  walletAddress: string;
  username: string;
}): Promise<ApiResult<{ ok: boolean }>> {
  return postJson("/v2/mpc/upgrade/ack-mnemonic-removed", {
    wallet_address: params.walletAddress,
    username: params.username,
  });
}

export async function createMpcWalletOnServer(params: {
  walletAddress: string;
  shareBEncryptedBase64: string;
  shareAEncryptedBase64?: string;
  username?: string;
}): Promise<ApiResult<{ wallet_type: string; wallet_address: string }>> {
  return postJson("/v2/mpc/wallets/create", {
    wallet_address: params.walletAddress,
    share_b_encrypted: params.shareBEncryptedBase64,
    share_a_encrypted: params.shareAEncryptedBase64,
    username: params.username,
  });
}

export async function backupMpcShareA(
  shareAEncryptedBase64: string,
  mpcSessionToken: string
): Promise<ApiResult<{ ok: boolean }>> {
  try {
    const response = await fetch(`${BASE_URL}/v2/mpc/device-share/backup`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpcSessionToken}`,
        "X-Mpc-Session-Token": mpcSessionToken,
      },
      body: JSON.stringify({ share_a_encrypted: shareAEncryptedBase64 }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        status: false,
        message: typeof json?.message === "string" ? json.message : "Backup failed",
      };
    }
    return { status: true, data: json as { ok: boolean } };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : "Request failed" };
  }
}

export async function registerPasskeyOnServer(params: {
  walletAddress: string;
  username: string;
  credentialId: string;
}): Promise<ApiResult<{ ok: boolean }>> {
  return postJson("/v2/mpc/passkey/register", {
    wallet_address: params.walletAddress,
    username: params.username,
    credential_id: params.credentialId,
  });
}

export async function fetchMpcShareB(
  walletAddress: string,
  mpcSessionToken: string
): Promise<ApiResult<{ share_b: string; share_a?: string | null; wallet_address: string }>> {
  try {
    const response = await fetch(`${BASE_URL}/v2/mpc/sign/share-b`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpcSessionToken}`,
        "X-Mpc-Session-Token": mpcSessionToken,
      },
      body: JSON.stringify({ wallet_address: walletAddress }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        status: false,
        message: typeof json?.message === "string" ? json.message : "Failed to fetch share",
      };
    }
    return {
      status: true,
      data: json as { share_b: string; share_a?: string | null; wallet_address: string },
    };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : "Request failed" };
  }
}

export async function openMpcWalletSession(params: {
  walletAddress: string;
  username: string;
  challenge: string;
  signature: string;
}): Promise<ApiResult<{ mpc_session_token: string; expires_in: number }>> {
  return postJson("/v2/mpc/session/open", {
    wallet_address: params.walletAddress,
    username: params.username,
    challenge: params.challenge,
    signature: params.signature,
  });
}

/** MPC session after OTP login when no server passkey is registered yet. */
export async function openMpcAccountRecoverySession(params: {
  walletAddress: string;
  username: string;
}): Promise<ApiResult<{ mpc_session_token: string; expires_in: number }>> {
  return postJson("/v2/mpc/session/open-account-recovery", {
    wallet_address: params.walletAddress,
    username: params.username,
  });
}
