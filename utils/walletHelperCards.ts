import type { BrainSuggestion } from "@/utils/store/brain.store";

export const LATEST_BRAIN_SUGGESTION_LIMIT = 4;

export type HelperCard = {
  id: string;
  title: string;
  caption: string;
  link: string;
};

export function buildHelperCards(
  suggestions: BrainSuggestion[],
  options?: { limit?: number }
): HelperCard[] {
  const sorted = [...suggestions].sort((a, b) => b.createdAt - a.createdAt);
  const sliced =
    sorted.slice(0, options?.limit ?? LATEST_BRAIN_SUGGESTION_LIMIT);

  const fromBrain = sliced.map((s) => ({
    id: s.id,
    title: s.title,
    caption: s.body,
    link: s.link ?? `/brain?focus=${encodeURIComponent(s.id)}`,
  }));

  if (fromBrain.length === 0) {
    return [
      {
        id: "brain-empty",
        title: "Brain",
        caption:
          "No suggestions yet. Tap to open Brain for alerts and actions.",
        link: "/brain",
      },
    ];
  }

  return fromBrain;
}
