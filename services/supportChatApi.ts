import { BASE_URL } from "@/utils/constant";
import { phoneForPushApi } from "@/utils/phone/phoneE164";
import type { UserType } from "@/utils/types/user.types";
import * as FileSystem from "expo-file-system";

export type SupportConversationStatus = "open" | "resolved" | "closed";
export type SupportSenderType = "user" | "admin";

export interface SupportConversation {
  id: number;
  addressbook_user_id?: number | null;
  phone_number?: string | null;
  wallet_address?: string | null;
  username?: string | null;
  status: SupportConversationStatus;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  unread_admin_count: number;
  unread_user_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SupportMessage {
  id: number;
  conversation_id: number;
  sender_type: SupportSenderType;
  sender_admin_id?: number | null;
  body: string;
  attachment_url?: string | null;
  attachment_mime?: string | null;
  attachment_original_name?: string | null;
  has_attachment?: boolean;
  read_at?: string | null;
  created_at?: string;
  admin?: { id: number; name: string } | null;
}

export type SupportImageAttachment = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export type SupportIdentity = {
  phone_number?: string;
  wallet_address?: string;
  user_id?: number;
  username?: string;
};

function apiOrigin(): string {
  if (!BASE_URL) return "";
  return BASE_URL.replace(/\/api\/?$/, "");
}

/** Align attachment host with the wallet API host (dev LAN vs localhost). */
export function resolveSupportAttachmentUrl(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined;
  const origin = apiOrigin();
  if (!origin) return url;

  try {
    const parsed = new URL(url);
    const api = new URL(origin);
    if (
      parsed.hostname !== api.hostname ||
      (parsed.port || "") !== (api.port || "")
    ) {
      parsed.hostname = api.hostname;
      parsed.port = api.port;
      parsed.protocol = api.protocol;
      return parsed.toString();
    }
  } catch {
    if (url.startsWith("/")) return `${origin}${url}`;
  }

  return url;
}

function identityFromUser(user: UserType | null | undefined): SupportIdentity {
  const phone = phoneForPushApi(user ?? null);
  return {
    phone_number: phone || undefined,
    wallet_address: user?.wallet_address || undefined,
    username: user?.username || undefined,
  };
}

function identityQuery(identity: SupportIdentity): string {
  const params = new URLSearchParams();
  if (identity.phone_number) params.set("phone_number", identity.phone_number);
  if (identity.wallet_address) params.set("wallet_address", identity.wallet_address);
  if (identity.user_id != null) params.set("user_id", String(identity.user_id));
  if (identity.username) params.set("username", identity.username);
  return params.toString();
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getSupportHistory(
  user: UserType | null | undefined
): Promise<SupportConversation[]> {
  if (!BASE_URL) return [];
  const identity = identityFromUser(user);
  if (!identity.phone_number && !identity.wallet_address) return [];

  const qs = identityQuery(identity);
  const res = await fetch(`${BASE_URL}/support/history?${qs}`);
  const json = await parseJson<{ success: boolean; data: SupportConversation[] }>(res);
  if (!res.ok || !json?.success) return [];
  return json.data ?? [];
}

export async function endSupportChat(
  conversationId: number,
  user: UserType | null | undefined
): Promise<SupportConversation | null> {
  if (!BASE_URL) return null;
  const identity = identityFromUser(user);
  const qs = identityQuery(identity);
  const res = await fetch(
    `${BASE_URL}/support/conversations/${conversationId}/end?${qs}`,
    { method: "PATCH" }
  );
  const json = await parseJson<{ success: boolean; data: SupportConversation }>(res);
  if (!res.ok || !json?.success) return null;
  return json.data;
}

export async function getActiveSupportConversation(
  user: UserType | null | undefined
): Promise<SupportConversation | null> {
  if (!BASE_URL) return null;
  const identity = identityFromUser(user);
  if (!identity.phone_number && !identity.wallet_address) return null;

  const qs = identityQuery(identity);
  const res = await fetch(`${BASE_URL}/support/conversation?${qs}`);
  const json = await parseJson<{ success: boolean; data: SupportConversation | null }>(res);
  if (!res.ok || !json?.success) return null;
  return json.data ?? null;
}

export const getSupportConversation = getActiveSupportConversation;

export async function getSupportMessages(
  conversationId: number,
  user: UserType | null | undefined
): Promise<{ conversation: SupportConversation; messages: SupportMessage[] } | null> {
  if (!BASE_URL) return null;
  const identity = identityFromUser(user);
  const qs = identityQuery(identity);
  const res = await fetch(
    `${BASE_URL}/support/conversations/${conversationId}/messages?${qs}`
  );
  const json = await parseJson<{
    success: boolean;
    data: { conversation: SupportConversation; messages: SupportMessage[] };
  }>(res);
  if (!res.ok || !json?.success) return null;
  return json.data;
}

async function readImageBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function sendSupportMessage(
  body: string,
  user: UserType | null | undefined,
  conversationId?: number,
  attachment?: SupportImageAttachment | null
): Promise<{
  conversation: SupportConversation;
  message: SupportMessage;
} | null> {
  if (!BASE_URL) return null;
  const identity = identityFromUser(user);
  const trimmed = body.trim();

  if (!trimmed && !attachment) return null;

  const payload: Record<string, unknown> = {
    ...identity,
    conversation_id: conversationId,
  };
  if (trimmed) payload.body = trimmed;

  if (attachment) {
    const mime = attachment.mimeType ?? "image/jpeg";
    const name = attachment.fileName ?? `support-${Date.now()}.jpg`;
    try {
      payload.attachment_base64 = await readImageBase64(attachment.uri);
      payload.attachment_mime = mime;
      payload.attachment_name = name;
    } catch {
      return null;
    }
  }

  const res = await fetch(`${BASE_URL}/support/messages`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await parseJson<{
    success: boolean;
    data: { conversation: SupportConversation; message: SupportMessage };
  }>(res);
  if (!res.ok || !json?.success) return null;
  return json.data;
}

export async function markSupportConversationRead(
  conversationId: number,
  user: UserType | null | undefined
): Promise<SupportConversation | null> {
  if (!BASE_URL) return null;
  const identity = identityFromUser(user);
  const qs = identityQuery(identity);
  const res = await fetch(
    `${BASE_URL}/support/conversations/${conversationId}/read?${qs}`,
    { method: "PATCH" }
  );
  const json = await parseJson<{ success: boolean; data: SupportConversation }>(res);
  if (!res.ok || !json?.success) return null;
  return json.data;
}
