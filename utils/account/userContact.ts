export type ServerAuthUser = {
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

  const phoneE164 = hasPhone ? data.phone_number!.trim() : undefined;
  const mobileNumber = hasPhone
    ? data.phone_number!.replace(/^\+\d+/, "")
    : "";

  return {
    username: data.username,
    mobileNumber,
    phoneE164,
    email: email || undefined,
    wallet_address: data.wallet_address || "",
    pin: "",
  };
}
