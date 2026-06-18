import { Buffer } from "buffer";

import type { Tool } from "@qvac/sdk";

import { scrubForSupertonic } from "./qvacVoiceAudio";
import { buildLanHttpBase, buildLanWsBase } from "./qvacLanUrls";
import {
  cleanAssistantReply,
  type QvacChatMessage,
  type QvacToolCall,
} from "./qvacVoiceCompletion";

type ChatMessage = { role: string; content: string };

type LanChatResponse = {
  text?: string;
  toolCalls?: QvacToolCall[];
  error?: string;
};

export class QvacLanVoiceClient {
  constructor(private readonly hostAddress: string) {}

  private httpBase() {
    const base = buildLanHttpBase(this.hostAddress);
    if (!base) {
      throw new Error("Add your laptop address from HeySolana Voice Host in AI Settings.");
    }
    return base;
  }

  private wsBase() {
    const base = buildLanWsBase(this.hostAddress);
    if (!base) {
      throw new Error("Add your laptop address from HeySolana Voice Host in AI Settings.");
    }
    return base;
  }

  async checkHealth(): Promise<void> {
    const res = await fetch(`${this.httpBase()}/health`, {
      method: "GET",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ready?: boolean;
      error?: string;
    };
    if (!res.ok || !data.ready) {
      throw new Error(
        data.error ||
          "Laptop host is not ready. Open HeySolana Voice Host and wait until models finish loading."
      );
    }
  }

  private async postChat(body: {
    history: QvacChatMessage[];
    useTools?: boolean;
    tools?: Tool[];
  }): Promise<LanChatResponse> {
    const res = await fetch(`${this.httpBase()}/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as LanChatResponse;
    if (!res.ok) {
      throw new Error(data.error || `Laptop chat failed (${res.status})`);
    }
    return data;
  }

  async embedText(text: string): Promise<number[] | null> {
    const res = await fetch(`${this.httpBase()}/v1/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      embedding?: number[] | null;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || `Laptop embed failed (${res.status})`);
    }
    return Array.isArray(data.embedding) ? data.embedding : null;
  }

  async complete(history: ChatMessage[]): Promise<string> {
    const data = await this.postChat({ history });
    return cleanAssistantReply(data.text ?? "");
  }

  async completeTurn(input: {
    history: QvacChatMessage[];
    useTools: boolean;
    tools: Tool[];
    executeToolCall: (call: QvacToolCall) => Promise<string>;
    onContentDelta?: (text: string) => void;
  }): Promise<string> {
    let history = [...input.history];
    let assistantText = "";

    for (let step = 0; step < 4; step += 1) {
      const data = await this.postChat({
        history,
        useTools: input.useTools,
        tools: input.useTools ? input.tools : undefined,
      });
      assistantText = cleanAssistantReply(data.text ?? "");
      if (assistantText) {
        input.onContentDelta?.(assistantText);
      }

      const toolCalls = data.toolCalls ?? [];
      if (toolCalls.length === 0) {
        return assistantText;
      }

      history = [...history, { role: "assistant", content: assistantText }];
      for (const call of toolCalls) {
        const toolResult = await input.executeToolCall(call);
        history = [...history, { role: "tool", content: toolResult }];
      }
    }

    return assistantText;
  }

  async speak(text: string): Promise<Buffer> {
    const safeText = scrubForSupertonic(text);
    if (!safeText) {
      throw new Error("Nothing to speak after removing unsupported characters");
    }

    const res = await fetch(`${this.httpBase()}/v1/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: safeText }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      wavBase64?: string;
      error?: string;
    };
    if (!res.ok || !data.wavBase64) {
      throw new Error(data.error || `Laptop speech failed (${res.status})`);
    }
    return Buffer.from(data.wavBase64, "base64");
  }

  connectTranscribe(onUtterance: (text: string) => void, onError: (message: string) => void) {
    const ws = new WebSocket(`${this.wsBase()}/v1/transcribe`);

    ws.onopen = () => {
      // ready for mic chunks
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as {
          type?: string;
          text?: string;
          message?: string;
        };
        if (payload.type === "utterance" && payload.text) {
          onUtterance(payload.text);
        }
        if (payload.type === "error" && payload.message) {
          onError(payload.message);
        }
      } catch {
        // ignore malformed events
      }
    };

    ws.onerror = () => {
      onError("Lost connection to laptop transcribe stream.");
    };

    return {
      sendAudio(chunk: Buffer) {
        if (ws.readyState !== WebSocket.OPEN) return;
        // React Native WebSocket only marks frames binary when sending ArrayBuffer/Uint8Array.
        const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        ws.send(bytes);
      },
      close() {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      },
    };
  }
}
