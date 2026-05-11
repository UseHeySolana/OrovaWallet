import { v4 as uuidv4 } from "uuid";

import BrainStore from "@/utils/store/brain.store";
import AppSettings from "@/utils/store/settingsstore.store";
import type { QvacBrainProvider } from "./qvacProvider";

export interface DigestOptions {
  qvac?: QvacBrainProvider | null;
}

/**
 * Generates suggestions from the local event journal.
 * Runs on-device; optionally uses a local OpenAI-compatible LLM endpoint (QVAC) if provided.
 */
export async function runBrainDigest(options: DigestOptions): Promise<void> {
  if (!BrainStore.getState().enabled) return;

  const { eventLog, digestIntervalMs, lastDigestAt } = BrainStore.getState();
  const now = Date.now();

  if (lastDigestAt && now - lastDigestAt < digestIntervalMs) return;

  // If there is nothing to summarize, just update lastDigestAt to avoid spamming.
  if (!eventLog.length) {
    BrainStore.getState().setLastDigestAt(now);
    return;
  }

  const recent = [...eventLog]
    .filter((e) => !lastDigestAt || e.createdAt > lastDigestAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 200);

  if (!recent.length) {
    BrainStore.getState().setLastDigestAt(now);
    return;
  }

  const suggestions = options.llm
    ? await generateSuggestionsWithLlm(recent, options.qvac)
    : generateSuggestionsHeuristic(recent);

  for (const s of suggestions) {
    BrainStore.getState().addSuggestion(s);
  }

  BrainStore.getState().setLastDigestAt(now);

  // One digest notification (not one-per-event).
  // Note: We intentionally avoid sending a notification here.
  // The Brain runtime can decide whether/when to notify, and/or show suggestions in-app.

  // Keep the journal but cap it; we can optionally clear old entries later.
}

function generateSuggestionsHeuristic(events: Array<{ summary: string; type: string }>) {
  const text = events.map((e) => `- [${e.type}] ${e.summary}`).join("\n");
  const top = [
    {
      id: uuidv4(),
      type: "insight" as const,
      title: "Activity summary",
      body: text.slice(0, 180) + (text.length > 180 ? "…" : ""),
      createdAt: Date.now(),
      link: "/brain",
      dedupeKey: `digest:summary:${Math.floor(Date.now() / (12 * 60 * 60_000))}`,
    },
  ];
  return top;
}

async function generateSuggestionsWithLlm(
  events: Array<{ summary: string; type: string; createdAt: number }>,
  qvac: QvacBrainProvider | null | undefined
) {
  if (!qvac) return generateSuggestionsHeuristic(events);
  const maxChars = 6000;
  const raw = events
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => `- ${new Date(e.createdAt).toISOString()} [${e.type}] ${e.summary}`)
    .join("\n")
    .slice(-maxChars);

  const prompt = [
    "You are the on-device wallet Brain.",
    "Given the user's recent events, create 1-4 suggested actions.",
    "Rules:",
    "- Output strict JSON only.",
    "- No emojis.",
    "- Suggestions must be safe and non-custodial; never request seed phrase.",
    "- Prefer: reminders, price alerts, helpful next steps, and optional trade ideas framed as suggestions.",
    "",
    "Return JSON array of objects with keys:",
    "{ type: 'trade'|'price_alert'|'reminder'|'insight'|'generic', title: string, body: string, link?: string, data?: object, dedupeKey?: string }",
    "",
    "Events:",
    raw,
  ].join("\n");

  const text = (await qvac.completeText({ user: prompt })).trim();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  const out: any[] = Array.isArray(parsed) ? parsed : [];
  const now = Date.now();
  return out
    .slice(0, 4)
    .map((s) => ({
      id: uuidv4(),
      type: s.type || "generic",
      title: String(s.title || "Suggestion"),
      body: String(s.body || ""),
      createdAt: now,
      link: typeof s.link === "string" ? s.link : "/brain",
      data: s.data,
      dedupeKey: s.dedupeKey,
    }))
    .filter((s) => s.body);
}

