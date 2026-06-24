let pendingConversationId: number | null = null;

export function setPendingSupportConversationId(id: number): void {
  pendingConversationId = id;
}

export function consumePendingSupportConversationId(): number | null {
  const id = pendingConversationId;
  pendingConversationId = null;
  return id;
}

export function parseSupportConversationId(
  data: Record<string, unknown> | undefined
): number | null {
  const raw = data?.conversation_id;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
