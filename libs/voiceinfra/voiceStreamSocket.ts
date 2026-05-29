export type VoiceStreamServerMessage =
  | { type: "state"; state: "listening" | "hearing" | "verifying" }
  | { type: "progress"; speech_seconds: number; buffer_bytes: number }
  | {
      type: "verified";
      verified: boolean;
      confidence: number;
      secondary_confidence?: number;
      threshold?: number;
      secondary_threshold?: number;
      isolated_audio?: string | null;
      speaker_count?: number;
      target_segment_count?: number;
      target_speech_seconds?: number;
      rejection_reason?: string | null;
      scores?: number[];
    }
  | {
      type: "rejected";
      verified: boolean;
      confidence: number;
      secondary_confidence?: number;
      threshold?: number;
      secondary_threshold?: number;
      rejection_reason?: string | null;
      message?: string;
      scores?: number[];
      speaker_count?: number;
      target_segment_count?: number;
      target_speech_seconds?: number | null;
    }
  | { type: "error"; message: string };

type VoiceStreamSocketOptions = {
  wsUrl: string;
  onMessage: (message: VoiceStreamServerMessage) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
};

export class VoiceStreamSocket {
  private socket: WebSocket | null = null;
  private closed = false;

  constructor(private options: VoiceStreamSocketOptions) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.closed = false;
      const socket = new WebSocket(this.options.wsUrl);
      this.socket = socket;
      socket.binaryType = "arraybuffer";

      socket.onopen = () => resolve();
      socket.onerror = () => {
        if (!this.closed) {
          reject(new Error("Voice stream WebSocket connection failed"));
        }
      };
      socket.onclose = () => {
        this.options.onClose?.();
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const parsed = JSON.parse(event.data) as VoiceStreamServerMessage;
          this.options.onMessage(parsed);
        } catch {
          // Ignore malformed frames.
        }
      };
    });
  }

  sendPcmChunk(chunk: Uint8Array): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(chunk);
  }

  endUtterance(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: "end" }));
  }

  close(): void {
    this.closed = true;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    this.socket = null;
  }
}
