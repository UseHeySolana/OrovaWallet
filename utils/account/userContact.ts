import {
  nationalNumberFromPhone,
  splitPhoneE164,
} from "@/utils/phone/phoneE164";

export type ServerAuthUser = {
  id?: number;
  username: string;
  wallet_address?: string;
  email?: string;
  phone_number?: string;
};

export function isLegacyEmailPhonePlaceholder(phone?: string | null): boolean {
  return Boolean(phone?.startsWith("email:"));
}

export function userHasMobileNumber(
  user: { phoneE164?: string; mobileNumber?: string } | null | undefined
): boolean {
  if (!user) return false;
  if (user.phoneE164?.trim()) return true;
  const local = user.mobileNumber?.trim();
  return Boolean(local && !local.includes("@"));
}

export function buildSessionUserFromServer(
  data: ServerAuthUser,
  fallbackEmail?: string
) {
  const legacyEmail = isLegacyEmailPhonePlaceholder(data.phone_number)
    ? data.phone_number!.slice("email:".length)
    : "";

  const email =
    data.email?.trim() || legacyEmail || fallbackEmail?.trim() || "";

  const hasPhone =
    Boolean(data.phone_number?.trim()) &&
    !isLegacyEmailPhonePlaceholder(data.phone_number);

  const rawPhone = hasPhone ? data.phone_number!.trim() : "";
  const split = hasPhone ? splitPhoneE164(rawPhone) : null;
  const phoneE164 = split?.e164 ?? (rawPhone || undefined);
  // Never use `/^\+\d+/` — that clears the entire E.164 string.
  const mobileNumber = hasPhone
    ? split?.nationalNumber || nationalNumberFromPhone(rawPhone)
    : "";

  const parsedId =
    typeof data.id === "number" && Number.isInteger(data.id) && data.id > 0
      ? data.id
      : typeof data.id === "string" && /^\d{1,10}$/.test(data.id.trim())
        ? Number(data.id.trim())
        : undefined;

  return {
    id: parsedId,
    username: data.username,
    mobileNumber,
    phoneE164,
    email: email || undefined,
    wallet_address: data.wallet_address || "",
    pin: "",
  };
}
