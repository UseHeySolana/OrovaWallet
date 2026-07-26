import { BASE_URL } from "@/utils/constant";
import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";
import { getTrackingUserKey } from "@/utils/tracker";

export type CommerceIntentType =
  | "search"
  | "product_selected"
  | "cart_pending"
  | "order_pending_payment"
  | "order_placed";

export interface UpsertCommerceIntentPayload {
  provider: string;
  intent_type: CommerceIntentType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  /** Minutes from now before a reminder may be sent. Default 45. */
  remind_after_minutes?: number;
  /** Stable key so the same cart/product upserts instead of duplicating. */
  dedupe_key?: string;
}

async function postIntent(path: string, body: object): Promise<boolean> {
  if (!BASE_URL) return false;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function walletAddress(): string {
  return (
    WalletItem.getState().publicKeyBase58 ??
    WalletItem.getState().publicKey?.toBase58?.() ??
    ""
  );
}

/**
 * Upsert a pending commerce habit/intent so we can remind via push or email.
 * Fire-and-forget — never blocks the UI.
 */
export async function upsertCommercePendingIntent(
  payload: UpsertCommerceIntentPayload
): Promise<void> {
  const wallet = walletAddress();
  if (!wallet) return;

  const user = UserItem.getState().user;
  const user_key = await getTrackingUserKey();

  await postIntent("/commerce/intents", {
    wallet_address: wallet,
    user_key,
    phone_number: user?.mobileNumber ?? null,
    email: user?.email ?? null,
    provider: payload.provider,
    intent_type: payload.intent_type,
    title: payload.title,
    body: payload.body,
    metadata: payload.metadata ?? {},
    remind_after_minutes: payload.remind_after_minutes ?? 45,
    dedupe_key:
      payload.dedupe_key ??
      `${payload.provider}:${payload.intent_type}:${wallet}`,
  });
}

/** Mark matching open intents completed (e.g. after order paid / cart cleared intentionally). */
export async function completeCommercePendingIntents(params: {
  provider?: string;
  intent_types?: CommerceIntentType[];
  dedupe_key?: string;
}): Promise<void> {
  const wallet = walletAddress();
  if (!wallet) return;

  await postIntent("/commerce/intents/complete", {
    wallet_address: wallet,
    provider: params.provider,
    intent_types: params.intent_types,
    dedupe_key: params.dedupe_key,
  });
}
