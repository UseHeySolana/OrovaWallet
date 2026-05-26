import { request } from "@/utils/request/db";

export type VoiceStatusResponse = {
  enrolled: boolean;
  sample_count?: number;
  last_verified_at?: string | null;
  algorithm_version?: string;
};

export type VoiceEnrollResponse = {
  status: string;
  enrolled: boolean;
  sample_count: number;
  algorithm_version: string;
};

export type VoiceVerifyResponse = {
  verified: boolean;
  enrolled: boolean;
  confidence: number;
  threshold?: number;
  transcript: string;
  message?: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message ?? "Voice verification request failed");
  }
  return data as T;
}

export async function fetchVoiceStatus(walletAddress: string): Promise<VoiceStatusResponse> {
  const response = await request.get(
    `/v2/voice/status?wallet_address=${encodeURIComponent(walletAddress)}`
  );
  return parseJsonResponse<VoiceStatusResponse>(response);
}

export async function enrollVoiceProfile(payload: {
  walletAddress: string;
  username?: string | null;
  samples: string[];
}): Promise<VoiceEnrollResponse> {
  const response = await request.postJson(
    {
      wallet_address: payload.walletAddress,
      username: payload.username,
      samples: payload.samples,
    },
    "/v2/voice/enroll"
  );
  return parseJsonResponse<VoiceEnrollResponse>(response);
}

export async function verifyVoiceCommand(payload: {
  walletAddress: string;
  audio: string;
  adapt?: boolean;
}): Promise<VoiceVerifyResponse> {
  const response = await request.postJson(
    {
      wallet_address: payload.walletAddress,
      audio: payload.audio,
      adapt: payload.adapt ?? true,
    },
    "/v2/voice/verify"
  );
  const data = (await response.json().catch(() => ({}))) as VoiceVerifyResponse & {
    message?: string;
  };

  if (response.status === 404) {
    return {
      verified: false,
      enrolled: false,
      confidence: 0,
      transcript: "",
      message: data?.message ?? "Voice enrollment required",
    };
  }

  if (!response.ok) {
    throw new Error(data?.message ?? "Voice verification request failed");
  }

  return data;
}
