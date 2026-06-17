import { Buffer } from "buffer";

import { buildLanHttpBase, buildLanWsBase } from "./qvacLanUrls";

type ChatMessage = { role: string; content: string };

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

  async complete(history: ChatMessage[]): Promise<string> {
    const res = await fetch(`${this.httpBase()}/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || `Laptop chat failed (${res.status})`);
    }
    return (data.text ?? "").trim();
  }

  async speak(text: string): Promise<Buffer> {
    const res = await fetch(`${this.httpBase()}/v1/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
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
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk);
        }
      },
      close() {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      },
    };
  }
}
