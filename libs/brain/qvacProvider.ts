import {
  startQVACProvider,
  stopQVACProvider,
  loadModel,
  unloadModel,
  completion,
  embed,
  LLAMA_3_2_1B_INST_Q4_0,
  EMBEDDINGGEMMA_300M_Q4_0,
  type CompletionFinal,
  type CompletionRun,
} from "@qvac/sdk";

import { ensureQvacHyperswarmSeed } from "@/libs/qvac/qvacSeed";
import { getQvacP2pManager } from "@/libs/qvac/qvacP2pManager";
import {
  QVAC_DELEGATE_TIMEOUT_MS,
  QVAC_LLM_MODEL_ID,
  isQvacP2pEnabled,
} from "@/libs/qvac/constants";
import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { BASE_URL } from "@/utils/constant";

type Role = "user" | "assistant" | "system";

export interface QvacBrainModelsConfig {
  llmModelSrc?: any;
  embeddingModelSrc?: any;
}

function parseTokenStats(stats: Record<string, unknown> | undefined | null) {
  const tokensOut = Number(
    stats?.completionTokens ?? stats?.tokensOut ?? stats?.outputTokens ?? 0
  );
  const tokensIn = Number(
    stats?.promptTokens ?? stats?.tokensIn ?? stats?.inputTokens ?? 0
  );
  const durationMs = Number(stats?.durationMs ?? stats?.duration_ms ?? 0);
  return { tokensIn, tokensOut, durationMs };
}

/**
 * On-device QVAC provider with optional P2P fallback + coordinator registration.
 */
export class QvacBrainProvider {
  private providerStarted = false;
  private providerPublicKey: string | null = null;
  private llmModelId: string | null = null;
  private embedModelId: string | null = null;
  private llmLoadError: string | null = null;
  private providerInitPromise: Promise<void> | null = null;
  private localModelsPromise: Promise<void> | null = null;
  private cfg: Required<QvacBrainModelsConfig>;

  constructor(cfg?: QvacBrainModelsConfig) {
    this.cfg = {
      llmModelSrc: cfg?.llmModelSrc ?? LLAMA_3_2_1B_INST_Q4_0,
      embeddingModelSrc: cfg?.embeddingModelSrc ?? EMBEDDINGGEMMA_300M_Q4_0,
    };
  }

  getProviderPublicKey() {
    return this.providerPublicKey;
  }

  isLocalLlmReady() {
    return !!this.llmModelId;
  }

  isReady() {
    return this.providerStarted && !!this.llmModelId && !!this.embedModelId;
  }

  /** Start DHT provider + optional coordinator registration (does not require local models). */
  async ensureProviderStarted(): Promise<void> {
    if (this.providerStarted) return;
    if (this.providerInitPromise) return this.providerInitPromise;

    this.providerInitPromise = (async () => {
      await ensureQvacHyperswarmSeed();

      const res = await startQVACProvider();
      this.providerPublicKey = res.publicKey ?? null;
      this.providerStarted = true;

      void this.loadLocalModelsInBackground();
    })();

    return this.providerInitPromise;
  }

  /** Load local models in background; failures enable P2P fallback. */
  private loadLocalModelsInBackground() {
    if (this.localModelsPromise) return this.localModelsPromise;

    this.localModelsPromise = (async () => {
      try {
        this.llmModelId = await loadModel({
          modelSrc: this.cfg.llmModelSrc,
          modelType: "llamacpp-completion",
          onProgress: () => {},
        });
        this.llmLoadError = null;

        const wallet =
          WalletItem.getState().publicKeyBase58 ??
          WalletItem.getState().publicKey?.toBase58() ??
          null;
        if (wallet && this.providerPublicKey) {
          await getQvacP2pManager().start(
            wallet,
            AppSettings.getState().shareCompute,
            this.providerPublicKey
          );
        }
      } catch (e) {
        this.llmLoadError = e instanceof Error ? e.message : "LLM load failed";
        this.llmModelId = null;
      }

      try {
        if (!this.embedModelId) {
          this.embedModelId = await loadModel({
            modelSrc: this.cfg.embeddingModelSrc,
            modelType: "llamacpp-embedding",
          });
        }
      } catch {
        this.embedModelId = null;
      }
    })();

    return this.localModelsPromise;
  }

  async ensureStarted(): Promise<void> {
    await this.ensureProviderStarted();
    if (this.localModelsPromise) {
      await this.localModelsPromise.catch(() => {});
    }
  }

  async shutdown(): Promise<void> {
    getQvacP2pManager().stop();

    const llm = this.llmModelId;
    const emb = this.embedModelId;
    this.providerStarted = false;
    this.providerPublicKey = null;
    this.llmModelId = null;
    this.embedModelId = null;
    this.llmLoadError = null;
    this.providerInitPromise = null;
    this.localModelsPromise = null;

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

  private async runCompletion(
    modelId: string,
    history: Array<{ role: Role; content: string }>
  ): Promise<CompletionFinal> {
    const run: CompletionRun = completion({
      modelId,
      history,
      stream: true,
    });

    for await (const _event of run.events) {
      // drain stream; final holds content + stats
    }

    return run.final;
  }

  private async completeDelegated(
    history: Array<{ role: Role; content: string }>
  ): Promise<string> {
    if (!isQvacP2pEnabled() || !BASE_URL) {
      throw new Error(this.llmLoadError || "Local model not ready");
    }

    const route = await getQvacP2pManager().routeForModel(QVAC_LLM_MODEL_ID);
    if (!route.job || !route.provider?.provider_public_key) {
      throw new Error(route.message || "No network providers available");
    }

    let delegatedModelId: string | null = null;
    try {
      delegatedModelId = await loadModel({
        modelSrc: this.cfg.llmModelSrc,
        modelType: "llamacpp-completion",
        delegate: {
          providerPublicKey: route.provider.provider_public_key,
          timeout: QVAC_DELEGATE_TIMEOUT_MS,
        },
      });

      const final = await this.runCompletion(delegatedModelId, history);
      const text = (final.contentText || "").trim();

      let { tokensIn, tokensOut, durationMs } = parseTokenStats(
        final.stats as Record<string, unknown> | undefined
      );
      if (!tokensOut && text) {
        tokensOut = Math.max(1, Math.ceil(text.length / 4));
      }

      await getQvacP2pManager()
        .submitReceipt({
          job_id: route.job.job_id,
          job_ticket: route.job.job_ticket,
          provider_public_key: route.provider.provider_public_key,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          duration_ms: durationMs,
        })
        .catch(() => {});

      return text;
    } finally {
      if (delegatedModelId) {
        try {
          await unloadModel({ modelId: delegatedModelId });
        } catch {}
      }
    }
  }

  async completeText(input: { system?: string; user: string }): Promise<string> {
    await this.ensureProviderStarted();

    const history: Array<{ role: Role; content: string }> = [];
    if (input.system) history.push({ role: "system", content: input.system });
    history.push({ role: "user", content: input.user });

    if (this.llmModelId) {
      const final = await this.runCompletion(this.llmModelId, history);
      return (final.contentText || "").trim();
    }

    if (this.localModelsPromise) {
      await this.localModelsPromise.catch(() => {});
    }

    if (this.llmModelId) {
      const final = await this.runCompletion(this.llmModelId, history);
      return (final.contentText || "").trim();
    }

    return this.completeDelegated(history);
  }

  async embedText(text: string): Promise<number[] | null> {
    await this.ensureStarted();
    if (!this.embedModelId) return null;

    try {
      const res = await embed({
        modelId: this.embedModelId,
        text,
      });
      return Array.isArray(res.embedding) ? res.embedding : null;
    } catch {
      return null;
    }
  }
}

let brainSingleton: QvacBrainProvider | null = null;

export function getQvacBrainProvider(): QvacBrainProvider {
  if (!brainSingleton) brainSingleton = new QvacBrainProvider();
  return brainSingleton;
}
