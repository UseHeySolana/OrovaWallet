import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import OpenAI from "openai";

import Convo from "@/utils/store/conversation.store";
import type { MessageType } from "@/utils/store/conversation.store";
import AppSettings from "@/utils/store/settingsstore.store";
import BrainStore from "@/utils/store/brain.store";
import { defaultLocalOpenAIBaseUrl } from "./localBaseUrl";
import { PriceWatcher } from "./priceWatcher";
import { runBrainDigest } from "./digest";
import type { BrainConfig, BrainEvent } from "./types";
import { v4 as uuidv4 } from "uuid";

type Unsubscribe = () => void;

const ANDROID_CHANNEL_ID = "brain-events";

function now() {
  return Date.now();
}

function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function buildToolTitle(action: string) {
  const cleaned = (action || "tool").replace(/[_-]/g, " ").trim();
  return cleaned ? cleaned : "Tool";
}

export class Brain {
  private config: Required<Pick<BrainConfig, "notificationsEnabled" | "llmEnabled">> &
    Omit<BrainConfig, "notificationsEnabled" | "llmEnabled">;

  private started = false;
  private unsubscribers: Unsubscribe[] = [];
  private lastToolStatusByMessageId = new Map<
    string,
    { status: "pending" | "failed" | "complete"; toolAction: string }
  >();

  private llmClient: OpenAI | null = null;
  private prevMessagesSnapshot: MessageType[] = [];
  private priceWatcher = new PriceWatcher();
  private appStateSub: { remove: () => void } | null = null;
  private digestTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: BrainConfig) {
    this.config = {
      notificationsEnabled: config?.notificationsEnabled ?? true,
      llmEnabled: config?.llmEnabled ?? false,
      llmBaseUrl: config?.llmBaseUrl,
      llmModel: config?.llmModel ?? "my-llm",
    };
  }

  isStarted() {
    return this.started;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    if (this.config.notificationsEnabled) {
      await this.initNotifications();
    }

    if (this.config.llmEnabled) {
      this.initLlm();
    }

    this.subscribeToConversationStore();
    this.startForegroundServices();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.lastToolStatusByMessageId.clear();
    this.llmClient = null;
    this.priceWatcher.stop();
    this.appStateSub?.remove?.();
    this.appStateSub = null;
    if (this.digestTimer) clearInterval(this.digestTimer);
    this.digestTimer = null;
  }

  private initLlm() {
    const baseURL =
      this.config.llmBaseUrl ||
      process.env.EXPO_PUBLIC_QVAC_BASE_URL ||
      defaultLocalOpenAIBaseUrl();

    // OpenAI SDK requires an apiKey string; local servers may ignore it.
    const apiKey =
      process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
      process.env.EXPO_PUBLIC_QVAC_API_KEY ||
      "local";

    this.llmClient = new OpenAI({ apiKey, baseURL });
  }

  private async initNotifications() {
    try {
      // Android requires a channel to show notifications reliably.
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: "Brain events",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: "default",
        });
      }

      const settings = await Notifications.getPermissionsAsync();
      if (settings.status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    } catch {
      // If notification setup fails, we keep Brain running but disable notifications.
      this.config.notificationsEnabled = false;
    }
  }

  private startForegroundServices() {
    // Respect app-level notification toggle.
    if (!AppSettings.getState().notifications) return;

    // Start/stop foreground pollers based on app state for battery.
    const onAppState = (state: string) => {
      if (state === "active") {
        this.priceWatcher.start();
        this.kickDigest().catch(() => {});
      } else {
        this.priceWatcher.stop();
      }
    };

    this.appStateSub = AppState.addEventListener("change", onAppState);
    onAppState(AppState.currentState);

    // Periodic digest check while active (actual digest only runs if 12h elapsed).
    this.digestTimer = setInterval(() => {
      if (AppState.currentState !== "active") return;
      this.kickDigest().catch(() => {});
    }, 5 * 60_000);
  }

  private async kickDigest() {
    await runBrainDigest({
      llm: this.config.llmEnabled && this.llmClient
        ? { client: this.llmClient, model: this.config.llmModel ?? "my-llm" }
        : null,
    });
  }

  private subscribeToConversationStore() {
    // Seed last-known tool statuses to avoid firing a burst on startup.
    const initialMessages = Convo.getState().messages;
    this.prevMessagesSnapshot = initialMessages;
    for (const m of initialMessages) {
      if (m?.tool?.status && m?.id && m?.tool?.action) {
        this.lastToolStatusByMessageId.set(m.id, {
          status: m.tool.status,
          toolAction: m.tool.action,
        });
      }
    }

    const unsub = Convo.subscribe((state) => {
      const next = state.messages;
      const prev = this.prevMessagesSnapshot;
      this.prevMessagesSnapshot = next;
      this.onMessagesChanged(next, prev);
    });
    this.unsubscribers.push(unsub);
  }

  private onMessagesChanged(messages: MessageType[], prevMessages: MessageType[]) {
    // Fast path: detect only new/updated messages by comparing lengths and ids.
    const prevById = new Map(prevMessages.map((m) => [m.id, m]));
    for (const msg of messages) {
      const prev = prevById.get(msg.id);

      if (!prev) {
        const e: BrainEvent = {
          type: "conversation.message.created",
          timestamp: msg.timestamp ?? now(),
          conversationId: msg.conversation_id,
          messageId: msg.id,
          role: msg.role,
          content: msg.content,
          source: msg.source,
        };
        this.emit(e);
      }

      const tool = msg.tool;
      if (!tool || !msg.id || !msg.conversation_id || !tool.action || !tool.status) continue;

      const last = this.lastToolStatusByMessageId.get(msg.id) || null;
      if (!last || last.status !== tool.status || last.toolAction !== tool.action) {
        const event: BrainEvent = {
          type: "conversation.tool.status_changed",
          timestamp: msg.timestamp ?? now(),
          conversationId: msg.conversation_id,
          messageId: msg.id,
          toolAction: tool.action,
          previousStatus: last?.status ?? null,
          status: tool.status,
          args: tool.arguments,
        };

        this.lastToolStatusByMessageId.set(msg.id, {
          status: tool.status,
          toolAction: tool.action,
        });

        this.emit(event);
      }
    }
  }

  private emit(_event: BrainEvent) {
    // Append to on-device event journal (used by 12h digest).
    try {
      if (_event.type === "conversation.message.created") {
        // Avoid logging huge messages; keep a short summary.
        const summary = (_event.content || "").trim().slice(0, 180);
        BrainStore.getState().appendEvent({
          id: uuidv4(),
          type: _event.type,
          createdAt: _event.timestamp,
          summary: summary ? `Message: ${summary}` : "Message created",
          conversationId: _event.conversationId,
          messageId: _event.messageId,
          data: { role: _event.role, source: _event.source },
        });
        return;
      }

      if (_event.type === "conversation.tool.status_changed") {
        BrainStore.getState().appendEvent({
          id: uuidv4(),
          type: _event.type,
          createdAt: _event.timestamp,
          summary: `${buildToolTitle(_event.toolAction)} ${_event.status}`,
          conversationId: _event.conversationId,
          messageId: _event.messageId,
          data: { toolAction: _event.toolAction, status: _event.status },
        });
        return;
      }
    } catch {
      // ignore
    }
  }

  private async generateNotificationBodyWithLlm(
    event: Extract<BrainEvent, { type: "conversation.tool.status_changed" }>
  ): Promise<string> {
    if (!this.llmClient) return "";

    const model = this.config.llmModel || "my-llm";
    const args = safeJsonStringify(event.args);

    const prompt = [
      "Write a short push-notification body (max 90 characters).",
      "No emojis. No quotes. No extra text.",
      `Context: toolAction=${event.toolAction}, status=${event.status}.`,
      args ? `Args: ${args}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Use the "Responses" API since you already use it elsewhere.
    const resp = await this.llmClient.responses.create({
      model,
      input: prompt,
    });

    const text = (resp.output_text || "").trim();
    return text || (event.status === "complete" ? "Tap to view details." : "Tap to review and retry.");
  }
}

