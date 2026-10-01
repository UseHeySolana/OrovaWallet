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
   * Controls whether Brain is allowed to call an OpenAI-compatible LLM endpoint
   * to generate better notification copy / summaries.
   */
  llmEnabled?: boolean;

  /**
   * OpenAI-compatible base URL for a local or remote LLM server.
   */
  llmBaseUrl?: string;

  /**
   * Model alias exposed by your local server (e.g. "my-llm").
   */
  llmModel?: string;
}

