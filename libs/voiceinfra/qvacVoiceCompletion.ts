import {
  completion,
  embed,
  type CompletionFinal,
  type CompletionRun,
  type Tool,
} from "@qvac/sdk";

import type { FunctionParams } from "@/utils/types/types";

type ChatRole = "system" | "user" | "assistant" | "tool";

export type QvacChatMessage = { role: ChatRole; content: string };

const THINK_BLOCK_RE =
  /<(?:redacted_)?think(?:ing)?>[\s\S]*?<\/(?:redacted_)?think(?:ing)?>/gi;
const UNCLOSED_THINK_RE = /<(?:redacted_)?think(?:ing)?>[\s\S]*$/i;

/** Remove Qwen thinking tags and leaked system-instruction echoes from user-visible text. */
export function cleanAssistantReply(text: string): string {
  let reply = text.replace(THINK_BLOCK_RE, "").replace(UNCLOSED_THINK_RE, "");

  reply = reply.replace(
    /You are a concise, friendly voice assistant\.[\s\S]*?over-confirm before acting\.?/gi,
    ""
  );
  reply = reply.replace(
    /Voice reply style \(always follow\):[\s\S]*?over-confirm before acting\.?/gi,
    ""
  );
  reply = reply.replace(/Never use markdown[\s\S]*?spoken aloud\.?/gi, "");

  return reply.replace(/\s+/g, " ").trim();
}

export function formatQvacTools(functions: FunctionParams[]): Tool[] {
  return functions.map((fn) => ({
    type: "function" as const,
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
  }));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

async function embedText(modelId: string, text: string): Promise<number[] | null> {
  try {
    const res = await embed({ modelId, text });
    return Array.isArray(res.embedding) ? res.embedding : null;
  } catch {
    return null;
  }
}

/** Rank wallet tools by embedding similarity to the user utterance. */
export async function selectRelevantTools(input: {
  embedModelId?: string;
  embedTextFn?: (text: string) => Promise<number[] | null>;
  userText: string;
  tools: FunctionParams[];
  maxTools?: number;
}): Promise<FunctionParams[]> {
  const maxTools = input.maxTools ?? 12;
  if (input.tools.length <= maxTools) return input.tools;

  const embedFn =
    input.embedTextFn ??
    (input.embedModelId
      ? (text: string) => embedText(input.embedModelId!, text)
      : null);

  if (!embedFn) return input.tools.slice(0, maxTools);

  const queryVec = await embedFn(input.userText);
  if (!queryVec) return input.tools.slice(0, maxTools);

  const scored: Array<{ tool: FunctionParams; score: number }> = [];
  for (const tool of input.tools) {
    const label = `${tool.name}: ${tool.description}`;
    const toolVec = await embedFn(label);
    scored.push({
      tool,
      score: toolVec ? cosineSimilarity(queryVec, toolVec) : 0,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxTools).map((entry) => entry.tool);
}

const WALLET_ACTION_RE =
  /\b(balance|swap|send|transfer|airtime|electricity|price|buy|sell|onramp|offramp|naira|deposit|withdraw|wallet|token|usdc|sol|mint|jumia|amazon|pajcash|bill|horoscope|weather)\b/i;

const TOOL_INTENT_THRESHOLD = 0.42;

/** Pick Qwen (tools) vs Llama (chat) for this utterance. */
export async function shouldUseToolModel(input: {
  userText: string;
  tools: FunctionParams[];
  embedModelId?: string;
  embedTextFn?: (text: string) => Promise<number[] | null>;
}): Promise<boolean> {
  if (WALLET_ACTION_RE.test(input.userText.trim())) {
    return true;
  }

  const embedFn =
    input.embedTextFn ??
    (input.embedModelId
      ? (text: string) => embedText(input.embedModelId!, text)
      : null);

  if (!embedFn || input.tools.length === 0) {
    return false;
  }

  try {
    const queryVec = await embedFn(input.userText);
    if (!queryVec) return false;

    let topScore = 0;
    for (const tool of input.tools) {
      const label = `${tool.name}: ${tool.description}`;
      const toolVec = await embedFn(label);
      if (toolVec) {
        topScore = Math.max(topScore, cosineSimilarity(queryVec, toolVec));
      }
    }

    return topScore >= TOOL_INTENT_THRESHOLD;
  } catch {
    return false;
  }
}

async function drainCompletion(
  run: CompletionRun,
  onContentDelta?: (text: string) => void
): Promise<CompletionFinal> {
  let streamedRaw = "";
  for await (const event of run.events) {
    if (event.type === "contentDelta") {
      streamedRaw += event.text;
      onContentDelta?.(cleanAssistantReply(streamedRaw));
    }
  }
  const final = await run.final;
  const raw = final.contentText || streamedRaw || final.raw?.fullText || "";
  const contentText = cleanAssistantReply(raw);
  if (!final.contentText && contentText) {
    return { ...final, contentText };
  }
  if (final.contentText) {
    return { ...final, contentText: cleanAssistantReply(final.contentText) };
  }
  return final;
}

function runCompletion(input: {
  modelId: string;
  history: QvacChatMessage[];
  tools?: Tool[];
  captureThinking?: boolean;
  onContentDelta?: (text: string) => void;
}): Promise<CompletionFinal> {
  const run = completion({
    modelId: input.modelId,
    history: input.history,
    stream: true,
    captureThinking: input.captureThinking ?? false,
    tools: input.tools,
  } as Parameters<typeof completion>[0]);
  return drainCompletion(run, input.onContentDelta);
}

export type QvacToolCall = CompletionFinal["toolCalls"][number];

/** Casual chat — Llama, no tools, no thinking blocks. */
export async function completeChatTurn(input: {
  modelId: string;
  history: QvacChatMessage[];
  onContentDelta?: (text: string) => void;
}): Promise<string> {
  const final = await runCompletion({
    modelId: input.modelId,
    history: input.history,
    onContentDelta: input.onContentDelta,
  });
  return cleanAssistantReply(
    (final.contentText || final.raw?.fullText || "").trim()
  );
}

/**
 * Run a voice turn: completion → optional tool execution → follow-up completion.
 */
export async function completeVoiceTurn(input: {
  modelId: string;
  history: QvacChatMessage[];
  tools: Tool[];
  onContentDelta?: (text: string) => void;
  executeToolCall: (call: QvacToolCall) => Promise<string>;
}): Promise<{ contentText: string; toolCalls: QvacToolCall[] }> {
  const first = await runCompletion({
    modelId: input.modelId,
    history: input.history,
    tools: input.tools,
    captureThinking: true,
    onContentDelta: input.onContentDelta,
  });

  let contentText = cleanAssistantReply(
    (first.contentText || first.raw?.fullText || "").trim()
  );
  if (first.toolCalls.length === 0) {
    return { contentText, toolCalls: first.toolCalls };
  }

  const followUpHistory: QvacChatMessage[] = [
    ...input.history,
    { role: "assistant", content: contentText },
  ];

  for (const call of first.toolCalls) {
    const toolResult = await input.executeToolCall(call);
    followUpHistory.push({ role: "tool", content: toolResult });
  }

  input.onContentDelta?.("\n");
  const followUp = await runCompletion({
    modelId: input.modelId,
    history: followUpHistory,
    tools: input.tools,
    captureThinking: true,
    onContentDelta: input.onContentDelta,
  });

  const followUpText = cleanAssistantReply(
    (followUp.contentText || followUp.raw?.fullText || "").trim()
  );
  contentText = followUpText || contentText;

  return { contentText, toolCalls: first.toolCalls };
}
