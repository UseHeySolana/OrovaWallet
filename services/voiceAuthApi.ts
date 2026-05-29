import { request } from "@/utils/request/db";

export type VoiceStatusResponse = {
  enrolled: boolean;
  sample_count?: number;
  threshold?: number;
  adapt_min_confidence?: number;
  last_verified_at?: string | null;
  algorithm_version?: string;
  voice_ai_enabled?: boolean;
  voice_ai_url?: string | null;
  voice_stream_verify_enabled?: boolean;
};

export type VoiceStreamSessionResponse = {
  session_id: string;
  ws_url: string;
  expires_in: number;
  threshold: number;
  algorithm_version: string;
};

export type VoiceEnrollResponse = {
  status: string;
  enrolled: boolean;
  sample_count: number;
  algorithm_version: string;
};

export class VoiceEnrollmentSimilarityError extends Error {
  sampleScores: number[];
  requiredSimilarity?: number;
  lowestSimilarity?: number;
  requiredPairSimilarity?: number;
  bestPairSimilarity?: number;

  constructor(payload: {
    message?: string;
    sample_scores?: number[];
    required_similarity?: number;
    lowest_similarity?: number;
    required_pair_similarity?: number;
    best_pair_similarity?: number;
  }) {
    super(payload.message ?? "Your voice samples do not sound similar enough.");
    this.name = "VoiceEnrollmentSimilarityError";
    this.sampleScores = Array.isArray(payload.sample_scores) ? payload.sample_scores : [];
    this.requiredSimilarity = payload.required_similarity;
    this.lowestSimilarity = payload.lowest_similarity;
    this.requiredPairSimilarity = payload.required_pair_similarity;
    this.bestPairSimilarity = payload.best_pair_similarity;
  }
}

export type VoiceVerifyResponse = {
  verified: boolean;
  enrolled: boolean;
  confidence: number;
  secondary_confidence?: number;
  threshold?: number;
  secondary_threshold?: number;
  stored_threshold?: number;
  adapted?: boolean;
  scores?: number[];
  duration_seconds?: number | null;
  speaker_count?: number;
  target_segment_count?: number;
  target_speech_seconds?: number | null;
  rejection_reason?: string | null;
  algorithm_version?: string;
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
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (
      Array.isArray(data?.sample_scores) ||
      typeof data?.required_similarity === "number" ||
      typeof data?.required_pair_similarity === "number"
    ) {
      throw new VoiceEnrollmentSimilarityError(data);
    }

    throw new Error(data?.message ?? "Voice enrollment request failed");
  }

  return data as VoiceEnrollResponse;
}

export async function createVoiceStreamSession(walletAddress: string): Promise<VoiceStreamSessionResponse> {
  const response = await request.postJson(
    { wallet_address: walletAddress },
    "/v2/voice/verify-stream/session"
  );
  return parseJsonResponse<VoiceStreamSessionResponse>(response);
}

export async function completeVoiceStreamVerification(payload: {
  walletAddress: string;
  sessionId: string;
  adapt?: boolean;
}): Promise<VoiceVerifyResponse> {
  const response = await request.postJson(
    {
      wallet_address: payload.walletAddress,
      session_id: payload.sessionId,
      adapt: payload.adapt ?? true,
    },
    "/v2/voice/verify-stream/complete"
  );
  const data = (await response.json().catch(() => ({}))) as VoiceVerifyResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data?.message ?? "Voice stream verification failed");
  }

  return data;
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
