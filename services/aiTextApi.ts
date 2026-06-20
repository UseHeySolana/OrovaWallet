import { BASE_URL } from "@/utils/constant";

export type AiTextTask =
  | "convert_speech"
  | "summarize_conversation"
  | "summarize_product"
  | "brain_digest";

export type AiTextEvent = {
  type: string;
  summary: string;
  createdAt: number;
  data?: unknown;
};

export type AiTextSuggestion = {
  type: string;
  title: string;
  body: string;
  link?: string;
  dedupeKey?: string | null;
  data?: unknown;
};

type AiTextResponse = {
  success?: boolean;
  text?: string;
  suggestions?: AiTextSuggestion[];
  message?: string;
};

export async function requestAiText(payload: {
  task: AiTextTask;
  text?: string;
  events?: AiTextEvent[];
}): Promise<AiTextResponse | null> {
  if (!BASE_URL) {
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}/ai/text`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AiTextResponse;
  } catch {
    return null;
  }
}

export async function requestAiTextLine(
  task: Exclude<AiTextTask, "brain_digest">,
  text: string
): Promise<string | null> {
  const result = await requestAiText({ task, text });
  const line = result?.text?.trim();
  return line || null;
}

export async function requestBrainDigestSuggestions(
  events: AiTextEvent[]
): Promise<AiTextSuggestion[]> {
  const result = await requestAiText({ task: "brain_digest", events });
  return Array.isArray(result?.suggestions) ? result.suggestions : [];
}
