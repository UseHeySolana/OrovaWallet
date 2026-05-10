export type BrainEvent =
  | {
      type: "conversation.tool.status_changed";
      timestamp: number;
      conversationId: string;
      messageId: string;
      toolAction: string;
      previousStatus: "pending" | "failed" | "complete" | null;
      status: "pending" | "failed" | "complete";
      args?: any;
    }
  | {
      type: "conversation.message.created";
      timestamp: number;
      conversationId: string;
      messageId: string;
      role: "system" | "user" | "tool";
      content: string;
      source?: string;
    };

export interface BrainConfig {
  /**
   * Enables local notifications. If disabled, Brain will still run and emit events,
   * but will not request permissions or schedule notifications.
   */
  notificationsEnabled?: boolean;

  /**
   * Controls whether Brain is allowed to call a local LLM endpoint (e.g. QVAC OpenAI-compatible server)
   * to generate better notification copy / summaries.
   */
  llmEnabled?: boolean;

  /**
   * OpenAI-compatible base URL. For QVAC server this is usually:
   * - iOS simulator: http://127.0.0.1:11434/v1
   * - Android emulator: http://10.0.2.2:11434/v1
   * - Physical device: http://<LAN-IP>:11434/v1 (must be provided)
   */
  llmBaseUrl?: string;

  /**
   * Model alias exposed by your local server (e.g. "my-llm").
   */
  llmModel?: string;
}

