/** Coordinator model id — must match `models` array sent on provider register. */
export const QVAC_LLM_MODEL_ID = "LLAMA_3_2_1B_INST_Q4_0";

export const QVAC_DELEGATE_TIMEOUT_MS = 60_000;

export const QVAC_HEARTBEAT_INTERVAL_MS = 30_000;

export function isQvacP2pEnabled(): boolean {
  const v = process.env.EXPO_PUBLIC_QVAC_P2P_ENABLED;
  return v === "1" || v === "true";
}
