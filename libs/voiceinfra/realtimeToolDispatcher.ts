import AppSettings from "@/utils/store/settingsstore.store";
import Convo from "@/utils/store/conversation.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import { FunctionParams } from "@/utils/types/types";
import tracker from "@/utils/tracker";
import { pushDevNetworkLog } from "@/utils/store/devNetworkLog.store";
import { refreshUserWalletBalances } from "@/utils/wallet/walletBalanceCache";

export type MessageSource = "voice" | "chat";

export type ToolDispatcherHost = {
  getConversationId: () => string | null;
  getFunctionMessageId: () => string | null;
  getAvailableFunctions: () => FunctionParams[];
  getMessageSource: () => MessageSource;
  setFunctionMessageId: (id: string | null) => void;
  sendClientEvent: (event: Record<string, unknown>) => void;
  createShortVoiceResponse: (overrides?: Record<string, unknown>) => void;
};

/**
 * Execute a realtime function call: UI pending card → handler → result/error event.
 */
export async function handleRealtimeFunctionCall(
  host: ToolDispatcherHost,
  functionCall: {
    name?: string;
    arguments?: unknown;
    call_id?: string;
    status?: string;
  }
): Promise<void> {
  const { name, arguments: argsJson, call_id } = functionCall;

  console.log(`[Function Call] Received:`, {
    name,
    call_id,
    arguments: argsJson,
    status: functionCall.status,
  });

  if (!name || !call_id) {
    console.error("[Function Call] Missing required fields (name or call_id)");
    return;
  }

  try {
    const functionDef = host.getAvailableFunctions().find((fn) => fn.name === name);

    if (!functionDef || !functionDef.handler) {
      throw new Error(`No handler found for function: ${name}`);
    }

    let args;
    if (typeof argsJson === "string") {
      try {
        args = JSON.parse(argsJson);
      } catch (parseError) {
        if (__DEV__) {
          pushDevNetworkLog({
            label: `Realtime tool args JSON.parse failed: ${name}`,
            method: "INTERNAL",
            url: `function:${name}`,
            status: 0,
            durationMs: 0,
            requestSummary:
              typeof argsJson === "string"
                ? argsJson.slice(0, 12_000)
                : String(argsJson).slice(0, 12_000),
            responseBody: String(parseError),
          });
        }
        throw new Error(`Failed to parse function arguments: ${parseError}`);
      }
    } else {
      args = argsJson;
    }

    console.log(`[Function Call] Executing ${name} with parsed args:`, args);

    if (host.getConversationId() !== null) {
      Convo.getState().setMessages({
        id: call_id,
        role: "tool",
        content: "",
        timestamp: new Date().getTime(),
        conversation_id: host.getConversationId()!,
        tool: {
          owner: functionDef.owner,
          status: "pending",
          action: functionDef.name,
          arguments: args,
        },
        source: host.getMessageSource(),
      });
      host.setFunctionMessageId(call_id);
    }

    const result = await functionDef.handler(args);
    tracker.tool_calls(name, 1);

    const functionMessageId = host.getFunctionMessageId();
    if (host.getConversationId() !== null && functionMessageId) {
      const toolMsg = Convo.getState().messages.find(
        (m) => m.id === functionMessageId
      );
      Convo.getState().updateMessage({
        messageId: functionMessageId,
        source: toolMsg?.source ?? "voice",
        toolUpdates: {
          status: "complete",
          action: functionDef.name,
          owner: functionDef.owner,
        },
      });
    }

    const resultEvent = {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: call_id,
        output: JSON.stringify(result),
      },
    };

    console.log(`[Function Call] Sending result back to model:`, resultEvent);
    host.sendClientEvent(resultEvent);

    setTimeout(() => {
      console.log(
        `[Function Call] Requesting model response with function result`
      );
      host.createShortVoiceResponse({
        instructions:
          "Summarize the tool result for voice in one short sentence. If the tool result includes an assistant_instruction or message field, follow it closely. Do not enumerate arrays, product names, prices, or links unless the tool explicitly asks you to.",
      });
    }, 300);
  } catch (error: any) {
    console.error(`[Function Call] Error executing ${name}:`, error);

    if (__DEV__) {
      let argsSummary = "";
      try {
        argsSummary =
          typeof argsJson === "string"
            ? argsJson.slice(0, 4000)
            : JSON.stringify(argsJson).slice(0, 4000);
      } catch {
        argsSummary = "«args unavailable»";
      }
      pushDevNetworkLog({
        label: `Tool handler error: ${name}`,
        method: "INTERNAL",
        url: `handler:${name}`,
        status: 0,
        durationMs: 0,
        requestSummary: argsSummary,
        responseBody: [error?.name, error?.message, error?.stack]
          .filter(Boolean)
          .join("\n")
          .slice(0, 12_000),
      });
    }

    AppSettings.getState().setLoading(false);

    const functionMessageId = host.getFunctionMessageId();
    if (host.getConversationId() !== null && functionMessageId) {
      const functionDef = host
        .getAvailableFunctions()
        .find((fn) => fn.name === name);

      Convo.getState().updateMessage({
        messageId: functionMessageId,
        source:
          Convo.getState().messages.find((m) => m.id === functionMessageId)
            ?.source ?? "voice",
        toolUpdates: {
          status: "failed",
          action: functionDef?.name || name,
          owner: functionDef?.owner,
        },
      });
    }

    const errorEvent = {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: call_id,
        output: JSON.stringify({
          error: error.message || "Unknown error",
          type: error.name || "FunctionExecutionError",
        }),
      },
    };

    console.log(`[Function Call] Sending error to model:`, errorEvent);
    host.sendClientEvent(errorEvent);

    setTimeout(() => {
      host.createShortVoiceResponse({
        instructions:
          "Explain the tool error briefly for voice in one short sentence and say what the user can try next.",
      });
    }, 300);
  }

  const userItem = UserItem.getState();
  const publicKey = WalletItem.getState().publicKey;
  if (userItem.user && publicKey) {
    await refreshUserWalletBalances({ force: true });
  }
}
