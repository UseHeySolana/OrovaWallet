import { v4 as uuidv4 } from "uuid";

import BrainStore, {
  type BrainEventLogItem,
  type BrainSuggestion,
  type BrainSuggestionType,
} from "@/utils/store/brain.store";
import { requestBrainDigestSuggestions } from "@/services/aiTextApi";
import { buildContextualBrainSuggestions } from "./contextualSuggestions";

export interface DigestOptions {
  /** Use backend OpenAI proxy for digest suggestions. */
  useBackendLlm?: boolean;
  /** Dev: bypass the 12h digest throttle (do not use in production flows). */
  devSkipDigestInterval?: boolean;
  /** Dev: summarize latest journal tail regardless of `lastDigestAt`. */
  devReprocessAllEvents?: boolean;
  /** Dev: unique `dedupeKey` so a new insight card is allowed each run. */
  devUniqueDedupeKey?: boolean;
}

const SUGGESTION_TYPES: BrainSuggestionType[] = [
  "trade",
  "price_alert",
  "reminder",
  "insight",
  "security",
  "generic",
];

function coerceSuggestionType(raw: unknown): BrainSuggestionType {
  const t = typeof raw === "string" ? raw : "generic";
  return (SUGGESTION_TYPES as string[]).includes(t) ? (t as BrainSuggestionType) : "generic";
}

/**
 * Uses the backend OpenAI proxy to turn the local journal into suggestion cards.
 */
async function generateSuggestionsWithBackend(
  events: BrainEventLogItem[]
): Promise<BrainSuggestion[]> {
  const payload = [...events]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-80)
    .map((event) => ({
      type: event.type,
      summary: event.summary,
      createdAt: event.createdAt,
      data: event.data,
    }));

  try {
    const parsed = await requestBrainDigestSuggestions(payload);
    if (!parsed.length) return [];

    const now = Date.now();
    return parsed
      .slice(0, 4)
      .map((s) => ({
        id: uuidv4(),
        type: coerceSuggestionType(s?.type),
        title: String(s?.title || "Suggestion").slice(0, 80),
        body: String(s?.body || "").slice(0, 280),
        createdAt: now,
        link: typeof s?.link === "string" && s.link.startsWith("/") ? s.link : "/dashboard/chat",
        dedupeKey: typeof s?.dedupeKey === "string" ? s.dedupeKey : undefined,
        data: s?.data,
      }))
      .filter((s: BrainSuggestion) => s.body.length > 4);
  } catch {
    return [];
  }
}

/**
 * Generates suggestions from the local event journal.
 * Order: OpenAI-compatible digest LLM → contextual rules.
 */
export async function runBrainDigest(options: DigestOptions): Promise<void> {
  if (!BrainStore.getState().enabled) return;

  const { eventLog, digestIntervalMs, lastDigestAt } = BrainStore.getState();
  const now = Date.now();

  if (!options.devSkipDigestInterval) {
    if (lastDigestAt && now - lastDigestAt < digestIntervalMs) return;
  }

  // Nothing to digest yet — do not advance lastDigestAt, or the 12h interval would
  // block the first digest after the user later gets chat/tool events in the journal.
  if (!eventLog.length) return;

  const recent = options.devReprocessAllEvents
    ? [...eventLog].sort((a, b) => b.createdAt - a.createdAt).slice(0, 200)
    : [...eventLog]
        .filter((e) => !lastDigestAt || e.createdAt > lastDigestAt)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 200);

  if (!recent.length) {
    if (!options.devSkipDigestInterval) {
      BrainStore.getState().setLastDigestAt(now);
    }
    return;
  }

  const ev = recent as BrainEventLogItem[];

  let suggestions: BrainSuggestion[];

  if (options.useBackendLlm) {
    suggestions = await generateSuggestionsWithBackend(ev);
    if (!suggestions.length) {
      suggestions = buildContextualBrainSuggestions(ev, options.devUniqueDedupeKey);
    }
  } else {
    suggestions = buildContextualBrainSuggestions(ev, options.devUniqueDedupeKey);
  }

  for (const s of suggestions) {
    BrainStore.getState().addSuggestion(s);
  }

  BrainStore.getState().setLastDigestAt(now);
}
