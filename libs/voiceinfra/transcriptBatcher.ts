import Convo from "@/utils/store/conversation.store";

export type MessageSource = "voice" | "chat";

export type TranscriptBatcherHost = {
  conversation_id: string | null;
  activeHumanMessageId: string | null;
  activeAiMessageId: string | null;
  getMessageSource: () => MessageSource;
};

/**
 * Batches rapid transcript deltas before writing to the conversation store
 * (avoids "Maximum update depth" from per-delta updates).
 */
export class TranscriptBatcher {
  static readonly FLUSH_MS = 80;

  private pendingHumanDeltas = "";
  private pendingAiDeltas = "";
  private flushHumanTimer: ReturnType<typeof setTimeout> | null = null;
  private flushAiTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly host: TranscriptBatcherHost) {}

  appendHuman(delta: string): void {
    this.pendingHumanDeltas += delta;
    this.scheduleFlushHuman();
  }

  appendAi(delta: string): void {
    this.pendingAiDeltas += delta;
    this.scheduleFlushAi();
  }

  flushHumanNow(): void {
    if (!this.host.activeHumanMessageId || !this.pendingHumanDeltas) return;
    const toApply = this.pendingHumanDeltas;
    this.pendingHumanDeltas = "";
    const currentContent =
      Convo.getState()
        .getConversationMessages(this.host.conversation_id!)
        ?.find((item) => item.id === this.host.activeHumanMessageId)?.content ??
      "";
    Convo.getState().updateMessage({
      messageId: this.host.activeHumanMessageId,
      content: { content: currentContent + toApply },
      source: "voice",
    });
  }

  flushAiNow(): void {
    if (!this.host.activeAiMessageId || !this.pendingAiDeltas) return;
    const toApply = this.pendingAiDeltas;
    this.pendingAiDeltas = "";
    const currentContent =
      Convo.getState()
        .getConversationMessages(this.host.conversation_id!)
        ?.find((item) => item.id === this.host.activeAiMessageId)?.content ?? "";
    Convo.getState().updateMessage({
      messageId: this.host.activeAiMessageId,
      content: { content: currentContent + toApply },
      source: this.host.getMessageSource(),
    });
  }

  cancelAll(): void {
    this.cancelFlushHuman();
    this.cancelFlushAi();
    this.pendingHumanDeltas = "";
    this.pendingAiDeltas = "";
  }

  private scheduleFlushHuman(): void {
    if (this.flushHumanTimer != null) return;
    this.flushHumanTimer = setTimeout(() => {
      this.flushHumanTimer = null;
      this.flushHumanNow();
    }, TranscriptBatcher.FLUSH_MS);
  }

  private cancelFlushHuman(): void {
    if (this.flushHumanTimer != null) {
      clearTimeout(this.flushHumanTimer);
      this.flushHumanTimer = null;
    }
  }

  private scheduleFlushAi(): void {
    if (this.flushAiTimer != null) return;
    this.flushAiTimer = setTimeout(() => {
      this.flushAiTimer = null;
      this.flushAiNow();
    }, TranscriptBatcher.FLUSH_MS);
  }

  private cancelFlushAi(): void {
    if (this.flushAiTimer != null) {
      clearTimeout(this.flushAiTimer);
      this.flushAiTimer = null;
    }
  }
}
