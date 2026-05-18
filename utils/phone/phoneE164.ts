import { cleanNumber } from "@/utils/functions/extrafunctions";

/** Canonical E.164-style value for API push registration (e.g. +2348012345678). */
export function toPhoneE164(
  localNumber: string,
  callingCode: string | string[] = "234"
): string {
  const code = Array.isArray(callingCode) ? callingCode[0] : callingCode;
  const digits = cleanNumber(localNumber);
  if (!digits) return "";
  return `+${code}${digits}`;
}

/** Prefer stored E.164; fall back to local number for legacy sessions. */
export function phoneForPushApi(user: {
  phoneE164?: string;
  mobileNumber?: string;
} | null): string | undefined {
  const e164 = user?.phoneE164?.trim();
  if (e164) return e164;
  const local = user?.mobileNumber?.trim();
  return local || undefined;
}
