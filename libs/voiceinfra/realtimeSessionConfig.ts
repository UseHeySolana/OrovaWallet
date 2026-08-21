import { FunctionParams } from "@/utils/types/types";

export const REALTIME_MODEL = "gpt-realtime-mini";

export type VadConfig = {
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
};

export type TurnDetectionConfig = {
  type: "server_vad";
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
  create_response: boolean;
  interrupt_response: boolean;
};

export function formatRealtimeTools(functions: FunctionParams[]) {
  return functions.map((fn) => {
    if (!fn.name) console.warn(`[Functions] Function missing name:`, fn);
    if (!fn.description) {
      console.warn(`[Functions] Function ${fn.name} missing description`);
    }
    if (!fn.parameters) {
      console.warn(`[Functions] Function ${fn.name} missing parameters`);
    }
    return {
      type: "function" as const,
      name: fn.name,
      description:
        typeof fn.getDescription === "function"
          ? fn.getDescription()
          : fn.description,
      parameters: fn.parameters,
    };
  });
}

export function getTurnDetectionConfig(opts: {
  useVoiceInputThisSession: boolean;
  pushToTalkMode: boolean;
  vadConfig: VadConfig;
}): TurnDetectionConfig | null {
  if (!opts.useVoiceInputThisSession || opts.pushToTalkMode) {
    return null;
  }
  return {
    type: "server_vad",
    threshold: opts.vadConfig.threshold,
    prefix_padding_ms: opts.vadConfig.prefix_padding_ms,
    silence_duration_ms: opts.vadConfig.silence_duration_ms,
    create_response: true,
    interrupt_response: true,
  };
}

export function buildGaSessionPayload(opts: {
  systemInstructions: string;
  availableFunctions: FunctionParams[];
  useVoiceInputThisSession: boolean;
  pushToTalkMode: boolean;
  vadConfig: VadConfig;
  overrides?: Record<string, unknown>;
}): Record<string, unknown> {
  const overrides = opts.overrides ?? {};
  const {
    turn_detection: turnDetectionOverride,
    audio: audioOverride,
    ...restOverrides
  } = overrides;

  const session: Record<string, unknown> = {
    type: "realtime",
    model: REALTIME_MODEL,
    // Always use audio output so chat mode gets spoken replies + transcript events.
    output_modalities: ["audio"],
    ...restOverrides,
  };

  if (
    overrides.instructions === undefined &&
    opts.systemInstructions.length > 0
  ) {
    session.instructions = opts.systemInstructions;
  }

  if (
    overrides.tools === undefined &&
    opts.availableFunctions.length > 0
  ) {
    session.tools = formatRealtimeTools(opts.availableFunctions);
    session.tool_choice = "auto";
  } else if (overrides.tools !== undefined) {
    session.tool_choice = overrides.tool_choice ?? "auto";
  }

  // GA Realtime: turn_detection lives under session.audio.input, not session root.
  const audioFromOverride =
    audioOverride && typeof audioOverride === "object"
      ? (audioOverride as Record<string, unknown>)
      : {};
  const inputFromOverride =
    audioFromOverride.input && typeof audioFromOverride.input === "object"
      ? (audioFromOverride.input as Record<string, unknown>)
      : {};

  const turnDetection =
    turnDetectionOverride !== undefined
      ? turnDetectionOverride
      : getTurnDetectionConfig({
          useVoiceInputThisSession: opts.useVoiceInputThisSession,
          pushToTalkMode: opts.pushToTalkMode,
          vadConfig: opts.vadConfig,
        });

  session.audio = {
    ...audioFromOverride,
    input: {
      ...inputFromOverride,
      transcription: inputFromOverride.transcription ?? {
        model: "gpt-4o-mini-transcribe",
        prompt:
          "Transcribe speech for Orova, a Solana crypto wallet assistant. Expect token symbols (SOL, USDC), amounts, mint addresses, swap, transfer, send, and usernames.",
      },
      turn_detection: turnDetection,
    },
  };

  return session;
}
