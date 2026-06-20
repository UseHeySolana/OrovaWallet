import { v4 as uuidv4 } from "uuid";

import BrainStore, {
  type BrainEventLogItem,
  type BrainSuggestion,
  type BrainSuggestionType,
} from "@/utils/store/brain.store";
import { requestBrainDigestSuggestions } from "@/services/aiTextApi";
import type { QvacBrainProvider } from "./qvacProvider";
import { buildContextualBrainSuggestions } from "./contextualSuggestions";

export interface DigestOptions {
  qvac?: QvacBrainProvider | null;
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

const APP_ROUTE_HINT = [
  "Allowed in-app link strings (use when helpful, one per suggestion):",
  "/dashboard",
  "/dashboard/chat",
  "/dashboard/swap",
  "/dashboard/send",
  "/dashboard/scan",
  "/dashboard/qrcode",
  "/dashboard/managetokens",
  "/dashboard/tokeninfo",
  "/dashboard/jumia",
  "/dashboard/account",
  "/settings",
  "/settings/security",
  "/brain",
].join("\n");

function parseSuggestionsJsonArray(raw: string): any[] | null {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/im.exec(t);
  if (fence) t = fence[1].trim();
  const i = t.indexOf("[");
  const j = t.lastIndexOf("]");
  if (i >= 0 && j > i) t = t.slice(i, j + 1);
  try {
    const v = JSON.parse(t);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
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
 * Order: QVAC provider (if passed) → OpenAI-compatible digest LLM → contextual rules.
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

  if (options.qvac) {
    suggestions = await generateSuggestionsWithLlm(ev, options.qvac);
  } else if (options.useBackendLlm) {
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

async function generateSuggestionsWithLlm(
  events: BrainEventLogItem[],
  qvac: QvacBrainProvider | null | undefined
): Promise<BrainSuggestion[]> {
  if (!qvac) return buildContextualBrainSuggestions(events, false);

  const maxChars = 6000;
  const raw = events
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => `- ${new Date(e.createdAt).toISOString()} [${e.type}] ${e.summary}`)
    .join("\n")
    .slice(-maxChars);

  const prompt = [
    "You are the on-device wallet Brain for Hey Solana.",
    "Given the user's recent events, create 2-4 short, actionable suggestions tied to what they did or said.",
    "Rules:",
    "- Output strict JSON only (a JSON array, no markdown).",
    "- No emojis.",
    "- Suggestions must be safe and non-custodial; never request seed phrase or private keys.",
    "- Prefer concrete next steps: swap, send, chat, settings/security, jumia, bills, etc.",
    "",
    "Return JSON array of objects with keys:",
    "{ type: 'trade'|'price_alert'|'reminder'|'insight'|'security'|'generic', title: string, body: string, link?: string, data?: object, dedupeKey?: string }",
    "",
    APP_ROUTE_HINT,
    "",
    "Events:",
    raw,
  ].join("\n");

  let text = "";
  try {
    text = (await qvac.completeText({ user: prompt })).trim();
  } catch {
    return buildContextualBrainSuggestions(events, false);
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = parseSuggestionsJsonArray(text);
  }

  const out: any[] = Array.isArray(parsed) ? parsed : [];
  const now = Date.now();
  const mapped = out
    .slice(0, 4)
    .map((s) => ({
      id: uuidv4(),
      type: coerceSuggestionType(s?.type),
      title: String(s?.title || "Suggestion").slice(0, 80),
      body: String(s?.body || "").slice(0, 280),
      createdAt: now,
      link:
        typeof s?.link === "string" && s.link.startsWith("/")
          ? s.link
          : "/dashboard/chat",
      data: s?.data,
      dedupeKey: typeof s?.dedupeKey === "string" ? s.dedupeKey : undefined,
    }))
    .filter((s: BrainSuggestion) => s.body.length > 4);

  if (!mapped.length) return buildContextualBrainSuggestions(events, false);
  return mapped;
}
