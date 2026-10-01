import { v4 as uuidv4 } from "uuid";

import BrainStore from "@/utils/store/brain.store";

import { runBrainDigest } from "./digest";

/** Wrapped SOL mint — Jupiter lite price `v3` accepts this id. */
export const DEV_SOL_MINT = "So11111111111111111111111111111111111111112";

const DEV_ALERT_PREFIX = "dev-test-alert-";

/**
 * Adds a SOL “above $0.01” alert so the foreground PriceWatcher should fire almost
 * immediately (SOL spot is always above one cent). Uses a short cooldown for retesting.
 */
export function addDevSolPriceAlert() {
  BrainStore.getState().addPriceAlert({
    id: `${DEV_ALERT_PREFIX}${Date.now()}`,
    tokenId: DEV_SOL_MINT,
    tokenSymbol: "SOL",
    currency: "USD",
    direction: "above",
    target: 0.01,
    createdAt: Date.now(),
    oneShot: false,
    cooldownMs: 15_000,
  });
}

export function clearDevPriceAlerts() {
  const ids = BrainStore.getState()
    .priceAlerts.filter((a) => a.id.startsWith(DEV_ALERT_PREFIX))
    .map((a) => a.id);
  for (const id of ids) {
    BrainStore.getState().removePriceAlert(id);
  }
}

/** A few synthetic journal rows so the contextual digest can match intents. */
export function seedDevBrainJournalSample() {
  const t = Date.now();
  BrainStore.getState().appendEvent({
    id: uuidv4(),
    type: "conversation.message.created",
    createdAt: t - 5000,
    summary: "Message: What is my SOL balance?",
    data: { role: "user" },
  });
  BrainStore.getState().appendEvent({
    id: uuidv4(),
    type: "conversation.message.created",
    createdAt: t - 4000,
    summary: "Message: You're all set — here's your balance.",
    data: { role: "assistant" },
  });
  BrainStore.getState().appendEvent({
    id: uuidv4(),
    type: "conversation.tool.status_changed",
    createdAt: t - 2000,
    summary: "Get balance complete",
    data: { toolAction: "get_balance", status: "complete" },
  });
}

/**
 * Runs digest like production, but skips the 12h gate, re-reads the whole journal tail,
 * and forces a new insight card (unique dedupe key). For __DEV__ tooling only.
 */
export async function runDevBrainDigestNow() {
  const useBackendLlm =
    process.env.EXPO_PUBLIC_BRAIN_SUGGESTIONS_LLM === "1" ||
    process.env.EXPO_PUBLIC_BRAIN_SUGGESTIONS_LLM === "true";

  await runBrainDigest({
    useBackendLlm,
    devSkipDigestInterval: true,
    devReprocessAllEvents: true,
    devUniqueDedupeKey: true,
  });
}
