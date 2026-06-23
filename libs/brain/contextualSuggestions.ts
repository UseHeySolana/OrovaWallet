import { v4 as uuidv4 } from "uuid";

import type { BrainEventLogItem, BrainSuggestion } from "@/utils/store/brain.store";

type IntentId =
  | "tool_failed"
  | "swap"
  | "balance"
  | "send"
  | "receive"
  | "bills"
  | "paj"
  | "jumia"
  | "markets"
  | "price"
  | "tokens"
  | "settings_security"
  | "chat_continue";

type Draft = { intent: IntentId; score: number; suggestion: BrainSuggestion };

function digestPeriodBucket(devUnique?: boolean) {
  if (devUnique) return `dev:${Date.now()}`;
  return String(Math.floor(Date.now() / (12 * 60 * 60_000)));
}

function userCorpus(events: BrainEventLogItem[]): string {
  const parts: string[] = [];
  for (const e of events) {
    if (e.type !== "conversation.message.created") continue;
    if ((e.data?.role as string | undefined) !== "user") continue;
    const t = (e.summary || "").replace(/^Message:\s*/i, "").trim();
    if (t) parts.push(t);
  }
  return parts.join(" \n ").toLowerCase();
}

function collectToolSlugs(events: BrainEventLogItem[]) {
  const completed: string[] = [];
  const failed: string[] = [];
  for (const e of events) {
    if (e.type !== "conversation.tool.status_changed") continue;
    const slug = String(e.data?.toolAction ?? "").toLowerCase();
    const st = e.data?.status as string | undefined;
    if (st === "complete" && slug) completed.push(slug);
    else if (st === "failed" && slug) failed.push(slug);
  }
  return { completed, failed };
}

function corpusMatches(re: RegExp, corpus: string) {
  re.lastIndex = 0;
  return re.test(corpus);
}

function slugMatches(slugs: string[], needles: string[]) {
  return slugs.some((s) => needles.some((n) => s.includes(n)));
}

/**
 * Proactive, app-aware suggestions derived from recent chat + tool journal.
 * Replaces the old single-card "session stats" digest for the no-LLM path.
 */
export function buildContextualBrainSuggestions(
  events: BrainEventLogItem[],
  devUniqueDedupeKey?: boolean
): BrainSuggestion[] {
  if (!events.length) return [];

  const bucket = digestPeriodBucket(devUniqueDedupeKey);
  const corpus = userCorpus(events);
  const { completed, failed } = collectToolSlugs(events);

  const drafts: Draft[] = [];

  if (failed.length) {
    const label = failed[0].replace(/_/g, " ").replace(/function/gi, "").trim() || "action";
    drafts.push({
      intent: "tool_failed",
      score: 100,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Retry in chat",
        body: `Something didn’t finish (${label}). Open the assistant and ask again — it can walk you through the steps.`,
        createdAt: Date.now(),
        link: "/dashboard/chat",
        dedupeKey: `digest:ctx:tool_failed:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(swap|trade|exchange|jupiter|convert|bridge)\b/i, corpus) ||
    slugMatches([...completed, ...failed], ["swap", "checkprice", "price"])
  ) {
    drafts.push({
      intent: "swap",
      score: 72,
      suggestion: {
        id: uuidv4(),
        type: "trade",
        title: "Want to swap tokens?",
        body: "Jump to Swap to move between tokens with a quote, or ask the assistant to compare routes first.",
        createdAt: Date.now(),
        link: "/dashboard/swap",
        dedupeKey: `digest:ctx:swap:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(
      /\b(balance|how much|holdings|portfolio|worth|my sol|tokens i have|what do i have)\b/i,
      corpus
    ) ||
    slugMatches([...completed, ...failed], ["balance", "wallet", "checkwallet"])
  ) {
    drafts.push({
      intent: "balance",
      score: 70,
      suggestion: {
        id: uuidv4(),
        type: "insight",
        title: "Check balances fast",
        body: "Ask the assistant for SOL and token balances, or open your dashboard to review holdings.",
        createdAt: Date.now(),
        link: "/dashboard/chat",
        dedupeKey: `digest:ctx:balance:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(send|transfer|pay|payout|airdrop|tip)\b/i, corpus) ||
    slugMatches([...completed, ...failed], ["transfer"])
  ) {
    drafts.push({
      intent: "send",
      score: 68,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Send tokens",
        body: "Send SOL or SPL tokens from Send — the assistant can also draft amounts and recipients from chat.",
        createdAt: Date.now(),
        link: "/dashboard/send",
        dedupeKey: `digest:ctx:send:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(receive|deposit|qr|my address|wallet address|show address)\b/i, corpus)
  ) {
    drafts.push({
      intent: "receive",
      score: 62,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Receive or share address",
        body: "Use Scan / QR from the dashboard to receive, or ask the assistant to show your public address.",
        createdAt: Date.now(),
        link: "/dashboard/scan",
        dedupeKey: `digest:ctx:receive:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(airtime|recharge|data plan|electricity|utility|bill pay|airbill)\b/i, corpus) ||
    slugMatches([...completed, ...failed], ["airtime", "internet", "electricity", "bill"])
  ) {
    drafts.push({
      intent: "bills",
      score: 66,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Airtime & utility",
        body: "You can buy airtime, mobile data, or electricity through the assistant’s bill tools — say the phone number or meter details you need.",
        createdAt: Date.now(),
        link: "/dashboard/chat",
        dedupeKey: `digest:ctx:bills:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(naira|off-?ramp|bank|ngn|paj|withdraw to bank)\b/i, corpus) ||
    slugMatches([...completed, ...failed], ["paj", "naira", "offramp"])
  ) {
    drafts.push({
      intent: "paj",
      score: 65,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Off-ramp & rates",
        body: "Ask about Naira rates or off-ramp steps in chat — the assistant can use your linked flows when available.",
        createdAt: Date.now(),
        link: "/dashboard/chat",
        dedupeKey: `digest:ctx:paj:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(jumia|shop|order|delivery|cart)\b/i, corpus) ||
    slugMatches([...completed, ...failed], ["jumia"])
  ) {
    drafts.push({
      intent: "jumia",
      score: 63,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Shop with Jumia",
        body: "Browse and place orders from the Jumia hub, or describe what you want in chat and let the assistant search.",
        createdAt: Date.now(),
        link: "/dashboard/jumia",
        dedupeKey: `digest:ctx:jumia:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(kalshi|bayse|prediction market|event contract|series)\b/i, corpus) ||
    slugMatches([...completed, ...failed], ["kalshi", "bayse"])
  ) {
    drafts.push({
      intent: "markets",
      score: 64,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Markets & events",
        body: "Kalshi and Bayse tools run through chat — ask to search markets, see quotes, or check your status.",
        createdAt: Date.now(),
        link: "/dashboard/chat",
        dedupeKey: `digest:ctx:markets:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(price|chart|pump|dump|moon|dip|target)\b/i, corpus) ||
    slugMatches([...completed, ...failed], ["checkprice", "price"])
  ) {
    drafts.push({
      intent: "price",
      score: 58,
      suggestion: {
        id: uuidv4(),
        type: "price_alert",
        title: "Track a price",
        body: "Ask the assistant for a live quote, or open Swap to act on a move. You can add Brain price alerts when that flow is enabled.",
        createdAt: Date.now(),
        link: "/dashboard/swap",
        dedupeKey: `digest:ctx:price:${bucket}`,
      },
    });
  }

  if (
    corpusMatches(/\b(hide token|add token|import token|spam token|manage tokens)\b/i, corpus)
  ) {
    drafts.push({
      intent: "tokens",
      score: 55,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Manage tokens",
        body: "Show, hide, or review custom tokens from Manage tokens so your home screen stays clean.",
        createdAt: Date.now(),
        link: "/dashboard/managetokens",
        dedupeKey: `digest:ctx:tokens:${bucket}`,
      },
    });
  }

  if (corpusMatches(/\b(seed|phrase|private key|recovery|backup|security)\b/i, corpus)) {
    drafts.push({
      intent: "settings_security",
      score: 50,
      suggestion: {
        id: uuidv4(),
        type: "security",
        title: "Security & recovery",
        body: "Never paste a seed phrase in chat. Use Settings → Security for recovery, biometrics, and private display options.",
        createdAt: Date.now(),
        link: "/settings/security",
        dedupeKey: `digest:ctx:security:${bucket}`,
      },
    });
  }

  if (corpus.length > 8) {
    drafts.push({
      intent: "chat_continue",
      score: 40,
      suggestion: {
        id: uuidv4(),
        type: "generic",
        title: "Continue the conversation",
        body: "Pick up where you left off — the assistant remembers this session’s tools and context while you’re in the app.",
        createdAt: Date.now(),
        link: "/dashboard/chat",
        dedupeKey: `digest:ctx:chat_continue:${bucket}`,
      },
    });
  }

  drafts.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: BrainSuggestion[] = [];
  for (const d of drafts) {
    const key = d.suggestion.dedupeKey ?? d.suggestion.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d.suggestion);
    if (out.length >= 4) break;
  }

  if (out.length === 0) {
    out.push({
      id: uuidv4(),
      type: "generic",
      title: "Ask Hey Solana",
      body: "Tell the assistant what you want next — send, swap, bills, shopping, or balances — and it will use the right tools.",
      createdAt: Date.now(),
      link: "/dashboard/chat",
      dedupeKey: `digest:ctx:fallback_chat:${bucket}`,
    });
  }

  return out;
}
