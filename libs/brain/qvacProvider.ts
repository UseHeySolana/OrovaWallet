import {
  startQVACProvider,
  stopQVACProvider,
  loadModel,
  unloadModel,
  completion,
  embed,
  LLAMA_3_2_1B_INST_Q4_0,
  EMBEDDINGGEMMA_300M_Q4_0,
} from "@qvac/sdk";

type Role = "user" | "assistant" | "system";

export interface QvacBrainModelsConfig {
  llmModelSrc?: any;
  embeddingModelSrc?: any;
}

/**
 * Minimal on-device QVAC provider for the Brain system.
 * - Separate from SessionManager realtime (no WebRTC, no OpenAI HTTP).
 * - Keeps models loaded for reuse.
 */
export class QvacBrainProvider {
  private started = false;
  private llmModelId: string | null = null;
  private embedModelId: string | null = null;
  private initPromise: Promise<void> | null = null;
  private cfg: Required<QvacBrainModelsConfig>;

  constructor(cfg?: QvacBrainModelsConfig) {
    this.cfg = {
      llmModelSrc: cfg?.llmModelSrc ?? LLAMA_3_2_1B_INST_Q4_0,
      embeddingModelSrc: cfg?.embeddingModelSrc ?? EMBEDDINGGEMMA_300M_Q4_0,
    };
  }

  async ensureStarted(): Promise<void> {
    if (this.started) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      await startQVACProvider();

      this.llmModelId = await loadModel({
        modelSrc: this.cfg.llmModelSrc,
        modelType: "llm",
      });

      this.embedModelId = await loadModel({
        modelSrc: this.cfg.embeddingModelSrc,
        modelType: "embeddings",
      });

      this.started = true;
    })();

    return this.initPromise;
  }

  isReady() {
    return this.started && !!this.llmModelId && !!this.embedModelId;
  }

  async shutdown(): Promise<void> {
    // Best-effort cleanup
    const llm = this.llmModelId;
    const emb = this.embedModelId;
    this.started = false;
    this.llmModelId = null;
    this.embedModelId = null;
    this.initPromise = null;

    try {
      if (llm) await unloadModel({ modelId: llm });
    } catch {}
    try {
      if (emb) await unloadModel({ modelId: emb });
    } catch {}
    try {
      await stopQVACProvider();
    } catch {}
  }

  async completeText(input: { system?: string; user: string }): Promise<string> {
    await this.ensureStarted();
    if (!this.llmModelId) return "";

    const history: Array<{ role: Role; content: string }> = [];
    if (input.system) history.push({ role: "system", content: input.system });
    history.push({ role: "user", content: input.user });

    const run = completion({
      modelId: this.llmModelId,
      history,
      stream: false,
    });

    // SDK typing: completion() returns a run object; when stream=false it should provide final text.
    // We fallback to concatenating tokenStream if needed.
    // @ts-ignore
    if (typeof run.text === "string") return run.text;

    let out = "";
    // @ts-ignore
    if (run.tokenStream && Symbol.asyncIterator in run.tokenStream) {
      // @ts-ignore
      for await (const token of run.tokenStream) out += token;
    }
    return out.trim();
  }

  async embedText(text: string): Promise<number[] | null> {
    await this.ensureStarted();
    if (!this.embedModelId) return null;

    const res = await embed({
      modelId: this.embedModelId,
      input: text,
    });

    // Typical embed output: { embeddings: number[][] }
    // @ts-ignore
    const vec = res?.embeddings?.[0];
    return Array.isArray(vec) ? vec : null;
  }
}

