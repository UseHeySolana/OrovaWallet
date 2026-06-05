import {
  completion,
  deleteCache,
  embed,
  loadModel,
  startQVACProvider,
  stopQVACProvider,
  unloadModel,
  type CompletionFinal,
  type CompletionRun,
  type Tool,
  EMBEDDINGGEMMA_300M_Q4_0,
  LLAMA_3_2_1B_INST_Q4_0,
  QWEN3_600M_INST_Q4,
} from "@qvac/sdk";

import { getAssistantPromptBase } from "@/libs/tool-implemetation/prompt";
import UserItem from "@/utils/store/userstore.store";

export type QvacDevLogFn = (line: string) => void;

export type QvacDevChatRole = "system" | "user" | "assistant" | "tool";

export interface QvacDevChatMessage {
  role: QvacDevChatRole;
  content: string;
}

export interface QvacDevChatResult {
  contentText: string;
  history: QvacDevChatMessage[];
  toolCalls: CompletionFinal["toolCalls"];
}

const weatherTool: Tool = {
  type: "function",
  name: "get_weather",
  description: "Get current weather for a city",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name" },
    },
    required: ["city"],
  },
};

const horoscopeTool: Tool = {
  type: "function",
  name: "get_horoscope",
  description: "Get today's horoscope for a zodiac sign",
  parameters: {
    type: "object",
    properties: {
      sign: { type: "string", description: "Zodiac sign" },
    },
    required: ["sign"],
  },
};

function mockExecuteTool(name: string, args: Record<string, unknown>): string {
  if (name === "get_weather") {
    const city = String(args.city ?? "unknown");
    return JSON.stringify({ city, temperature: 22, condition: "sunny" });
  }
  if (name === "get_horoscope") {
    const sign = String(args.sign ?? "unknown");
    return JSON.stringify({ sign, summary: "A surprising opportunity appears today." });
  }
  return JSON.stringify({ error: "unknown tool" });
}

function buildQvacAssistantPrompt(useTools: boolean): string {
  const { user, userWallet } = UserItem.getState();
  const tokenDetails = userWallet?.tokenAccounts?.map((token: any) => ({
    name: token.name,
    image: token.image,
    symbol: token.symbol,
    balance:
      Number(token.balance) > 0 ? Number(token.balance).toFixed(2) : token.balance,
    decimals: token.decimals,
    usdc_price: token.usdc_price,
    mint: token.mint,
  }));

  const walletContext = user
    ? `this is the list of tokens in the user wallet ${JSON.stringify(
        tokenDetails ?? [],
        null,
        2
      )} this is the user details ${
        "UserName: " +
        user?.username +
        "," +
        "Total Balance in SOL : " +
        "\n" +
        userWallet?.balance +
        ", Total Balance in USD/Dollars:" +
        userWallet?.totalUsdBalance +
        "\n" +
        ", Sol token balance alone " +
        "\n" +
        userWallet?.solBalance
      }`
    : "";

  const qvacDevContext = useTools
    ? `

QVAC dev chat tool sandbox:
- The only tools currently available in this dev screen are get_weather(city) and get_horoscope(sign).
- Use those tools when the user asks for weather or horoscope information.
- Do not claim you can execute real wallet actions from this dev QVAC screen yet; ask to use the main assistant for production wallet actions.
`
    : `

QVAC dev chat:
- This local QVAC screen is for text completion only unless tool calling is enabled before Start.
- Do not claim you can execute real wallet actions from this dev QVAC screen yet; ask to use the main assistant for production wallet actions.
`;

  return `${getAssistantPromptBase()}${walletContext}${qvacDevContext}`;
}

async function consumeEvents(
  run: CompletionRun,
  log: QvacDevLogFn,
  opts?: { streamContent?: boolean }
): Promise<CompletionFinal> {
  let streamed = "";
  for await (const event of run.events) {
    switch (event.type) {
      case "contentDelta":
        streamed += event.text;
        if (opts?.streamContent) log(event.text);
        break;
      case "thinkingDelta":
        log(`[thinking] ${event.text}`);
        break;
      case "toolCall":
        log(
          `[toolCall] ${event.call.name}(${JSON.stringify(event.call.arguments)})`
        );
        break;
      case "toolError":
        log(`[toolError] ${event.error.code}: ${event.error.message}`);
        break;
      case "completionStats":
        log(
          `[stats] ${event.stats.tokensPerSecond?.toFixed(1) ?? "?"} tok/s`
        );
        break;
      case "completionDone":
        if (event.stopReason === "error" && "error" in event) {
          log(`[done:error] ${event.error.message}`);
        } else {
          log(`[done] ${event.stopReason}`);
        }
        break;
      case "rawDelta":
        break;
    }
  }

  const final = await run.final;
  if (!opts?.streamContent && final.contentText) {
    log(`[final] ${final.contentText}`);
  } else if (opts?.streamContent && streamed && !final.contentText) {
    log(`[final] ${streamed}`);
  }
  if (final.thinkingText) log(`[thinking-final] ${final.thinkingText}`);
  if (final.stats) {
    log(`[stats-final] ${JSON.stringify(final.stats)}`);
  }
  return final;
}

async function consumeChatEvents(
  run: CompletionRun,
  handlers: {
    onContentDelta: (text: string) => void;
    onLog: QvacDevLogFn;
  }
): Promise<CompletionFinal> {
  for await (const event of run.events) {
    switch (event.type) {
      case "contentDelta":
        handlers.onContentDelta(event.text);
        break;
      case "thinkingDelta":
        handlers.onLog(`[thinking] ${event.text}`);
        break;
      case "toolCall":
        handlers.onLog(
          `[toolCall] ${event.call.name}(${JSON.stringify(event.call.arguments)})`
        );
        break;
      case "toolError":
        handlers.onLog(`[toolError] ${event.error.code}: ${event.error.message}`);
        break;
      case "completionStats":
        handlers.onLog(
          `[stats] ${event.stats.tokensPerSecond?.toFixed(1) ?? "?"} tok/s`
        );
        break;
      case "completionDone":
        handlers.onLog(`[done] ${event.stopReason}`);
        break;
      case "rawDelta":
        break;
    }
  }

  return run.final;
}

export class QvacDevLab {
  private started = false;
  private llmModelId: string | null = null;
  private toolModelId: string | null = null;
  private embedModelId: string | null = null;

  isLlmLoaded() {
    return !!this.llmModelId;
  }

  isToolModelLoaded() {
    return !!this.toolModelId;
  }

  isEmbedLoaded() {
    return !!this.embedModelId;
  }

  getStatus() {
    return {
      started: this.started,
      llmModelId: this.llmModelId,
      toolModelId: this.toolModelId,
      embedModelId: this.embedModelId,
    };
  }

  private async ensureProvider(log: QvacDevLogFn) {
    if (this.started) return;
    log("Starting QVAC provider...");
    await startQVACProvider();
    this.started = true;
    log("QVAC provider ready");
  }

  async loadLlm(log: QvacDevLogFn) {
    await this.ensureProvider(log);
    if (this.llmModelId) {
      log(`LLM already loaded: ${this.llmModelId}`);
      return this.llmModelId;
    }

    log("Loading LLAMA_3_2_1B_INST_Q4_0...");
    const modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: "llm",
      modelConfig: { ctx_size: 2048 },
      onProgress: (p) =>
        log(`LLM download ${p.percentage?.toFixed?.(1) ?? "?"}%`),
    });
    this.llmModelId = modelId;
    log(`LLM loaded: ${modelId}`);
    return modelId;
  }

  async loadToolModel(log: QvacDevLogFn) {
    await this.ensureProvider(log);
    if (this.toolModelId) {
      log(`Tool model already loaded: ${this.toolModelId}`);
      return this.toolModelId;
    }

    log("Loading QWEN3_600M_INST_Q4 (tools enabled)...");
    const modelId = await loadModel({
      modelSrc: QWEN3_600M_INST_Q4,
      modelType: "llm",
      modelConfig: {
        ctx_size: 4096,
        tools: true,
      },
      onProgress: (p) =>
        log(`Tool model download ${p.percentage?.toFixed?.(1) ?? "?"}%`),
    });
    this.toolModelId = modelId;
    log(`Tool model loaded: ${modelId}`);
    return modelId;
  }

  async loadEmbed(log: QvacDevLogFn) {
    await this.ensureProvider(log);
    if (this.embedModelId) {
      log(`Embedding model already loaded: ${this.embedModelId}`);
      return this.embedModelId;
    }

    log("Loading EMBEDDINGGEMMA_300M_Q4_0...");
    const modelId = await loadModel({
      modelSrc: EMBEDDINGGEMMA_300M_Q4_0,
      modelType: "embeddings",
      onProgress: (p) =>
        log(`Embed download ${p.percentage?.toFixed?.(1) ?? "?"}%`),
    });
    this.embedModelId = modelId;
    log(`Embedding model loaded: ${modelId}`);
    return modelId;
  }

  async runStreamingCompletion(log: QvacDevLogFn) {
    if (!this.llmModelId) throw new Error("Load the LLM first");

    log("--- Streaming completion (events API) ---");
    const run = completion({
      modelId: this.llmModelId,
      history: [
        {
          role: "user",
          content: "Explain Solana in two short sentences.",
        },
      ],
      stream: true,
      captureThinking: true,
      emitRawDeltas: false,
    });

    await consumeEvents(run, log, { streamContent: true });
  }

  async runToolCall(log: QvacDevLogFn) {
    if (!this.toolModelId) throw new Error("Load the tool model first");

    const tools = [weatherTool, horoscopeTool];
    const history: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: buildQvacAssistantPrompt(true),
      },
      {
        role: "user",
        content: "What's the weather in Tokyo and my horoscope for Aquarius?",
      },
    ];

    log("--- Tool call (first turn) ---");
    const result = completion({
      modelId: this.toolModelId,
      history,
      stream: true,
      tools,
    });
    const first = await consumeEvents(result, log, { streamContent: true });

    if (first.toolCalls.length === 0) {
      log("No tool calls detected in first turn");
      return;
    }

    log("--- Simulating tool execution ---");
    history.push({
      role: "assistant",
      content: first.contentText || first.raw.fullText,
    });

    for (const call of first.toolCalls) {
      const toolResult = mockExecuteTool(call.name, call.arguments);
      log(`[toolResult] ${call.name}: ${toolResult}`);
      history.push({
        role: "tool",
        content: toolResult,
      });
    }

    log("--- Tool call (follow-up turn) ---");
    const followUp = completion({
      modelId: this.toolModelId,
      history,
      stream: true,
      tools,
    });
    await consumeEvents(followUp, log, { streamContent: true });
  }

  async streamChat(input: {
    history: QvacDevChatMessage[];
    useTools: boolean;
    onContentDelta: (text: string) => void;
    onLog: QvacDevLogFn;
  }): Promise<QvacDevChatResult> {
    const { history, useTools, onContentDelta, onLog } = input;
    const modelId = useTools
      ? await this.loadToolModel(onLog)
      : await this.loadLlm(onLog);
    const tools = useTools ? [weatherTool, horoscopeTool] : undefined;
    const historyWithInstructions: QvacDevChatMessage[] = [
      { role: "system", content: buildQvacAssistantPrompt(useTools) },
      ...history.filter((message) => message.role !== "system"),
    ];

    const run = completion({
      modelId,
      history: historyWithInstructions,
      stream: true,
      captureThinking: true,
      tools,
    } as any);

    let contentText = "";
    const first = await consumeChatEvents(run, {
      onContentDelta: (text) => {
        contentText += text;
        onContentDelta(text);
      },
      onLog,
    });

    contentText = first.contentText || contentText || first.raw.fullText;

    if (!useTools || first.toolCalls.length === 0) {
      return {
        contentText,
        history: [...history, { role: "assistant", content: contentText }],
        toolCalls: first.toolCalls,
      };
    }

    const followUpHistory: QvacDevChatMessage[] = [
      ...historyWithInstructions,
      { role: "assistant", content: contentText },
    ];

    for (const call of first.toolCalls) {
      const toolResult = mockExecuteTool(call.name, call.arguments);
      onLog(`[toolResult] ${call.name}: ${toolResult}`);
      followUpHistory.push({ role: "tool", content: toolResult });
    }

    onLog("Running follow-up completion with tool results...");
    const followUp = completion({
      modelId,
      history: followUpHistory,
      stream: true,
      tools,
    } as any);

    let followUpText = "";
    const final = await consumeChatEvents(followUp, {
      onContentDelta: (text) => {
        followUpText += text;
        onContentDelta(text);
      },
      onLog,
    });
    followUpText = final.contentText || followUpText || final.raw.fullText;
    const mergedText = [contentText, followUpText].filter(Boolean).join("\n\n");

    return {
      contentText: mergedText,
      history: [...followUpHistory, { role: "assistant", content: followUpText }],
      toolCalls: first.toolCalls,
    };
  }

  async runKvCache(log: QvacDevLogFn) {
    if (!this.llmModelId) throw new Error("Load the LLM first");

    log("--- KV cache: turn 1 (build cache) ---");
    const history1 = [{ role: "user", content: "What is the capital of France?" }];
    const result1 = completion({
      modelId: this.llmModelId,
      history: history1,
      stream: true,
      kvCache: true,
    });
    const final1 = await consumeEvents(result1, log, { streamContent: true });
    log(`Turn 1 stats: ${JSON.stringify(final1.stats ?? {})}`);

    const history2 = [
      { role: "user", content: "What is the capital of France?" },
      {
        role: "assistant",
        content: final1.cacheableAssistantContent ?? final1.contentText,
      },
      { role: "user", content: "What about Germany?" },
    ];

    log("--- KV cache: turn 2 (reuse cache) ---");
    const result2 = completion({
      modelId: this.llmModelId,
      history: history2,
      stream: true,
      kvCache: true,
    });
    const final2 = await consumeEvents(result2, log, { streamContent: true });
    log(`Turn 2 (cached) stats: ${JSON.stringify(final2.stats ?? {})}`);

    log("--- KV cache: turn 2 again (no cache) ---");
    const result3 = completion({
      modelId: this.llmModelId,
      history: history2,
      stream: true,
      kvCache: false,
    });
    const final3 = await consumeEvents(result3, log, { streamContent: true });
    log(`Turn 2 (no cache) stats: ${JSON.stringify(final3.stats ?? {})}`);
  }

  async runEmbed(log: QvacDevLogFn) {
    if (!this.embedModelId) throw new Error("Load the embedding model first");

    log("--- Embedding ---");
    const res = await embed({
      modelId: this.embedModelId,
      text: "Solana is a fast layer-1 blockchain.",
    });
    const vec = res.embedding;
    if (!Array.isArray(vec)) {
      log("Embed returned no vector");
      return;
    }
    log(`Embedding dims: ${vec.length}`);
    log(`First values: ${vec.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}`);
  }

  async clearKvCache(log: QvacDevLogFn) {
    log("Clearing all KV caches...");
    await deleteCache({ all: true });
    log("KV caches cleared");
  }

  async unloadAll(log: QvacDevLogFn) {
    const llm = this.llmModelId;
    const tool = this.toolModelId;
    const embed = this.embedModelId;
    this.llmModelId = null;
    this.toolModelId = null;
    this.embedModelId = null;

    if (llm) {
      try {
        await unloadModel({ modelId: llm, clearStorage: false });
        log(`Unloaded LLM: ${llm}`);
      } catch (e: unknown) {
        log(`LLM unload failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (tool) {
      try {
        await unloadModel({ modelId: tool, clearStorage: false });
        log(`Unloaded tool model: ${tool}`);
      } catch (e: unknown) {
        log(
          `Tool model unload failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    if (embed) {
      try {
        await unloadModel({ modelId: embed, clearStorage: false });
        log(`Unloaded embedding model: ${embed}`);
      } catch (e: unknown) {
        log(
          `Embedding unload failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    if (this.started) {
      try {
        await stopQVACProvider();
        this.started = false;
        log("QVAC provider stopped");
      } catch (e: unknown) {
        log(
          `Provider stop failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }
}

export const qvacDevLab = new QvacDevLab();
