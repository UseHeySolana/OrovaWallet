import {
  isValidNationalMobileNumber,
  normalizeNationalMobileInput,
  toPhoneE164,
} from "@/utils/phone/phoneE164";

export type SmartContactMode = "neutral" | "email" | "phone";

export type CountrySelection = {
  callingCode: string[] | string;
  countryInitials: string;
  name: string;
  region: string;
  subregion: string;
};

/** Phone values are digits only (spaces, dashes, +, etc. allowed for formatting). */
export function isPhoneLikeValue(value: string): boolean {
  const stripped = value.replace(/[\s\-().+]/g, "");
  return stripped.length > 0 && /^\d+$/.test(stripped);
}

export function detectSmartContactMode(value: string): SmartContactMode {
  const trimmed = value.trim();
  if (!trimmed) return "neutral";
  if (trimmed.includes("@")) return "email";
  if (isPhoneLikeValue(trimmed)) return "phone";
  return "neutral";
}

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function getCallingCode(selectedValue: CountrySelection): string {
  const code = selectedValue.callingCode;
  return String(Array.isArray(code) ? code[0] : code);
}

export type ParsedSmartContact =
  | { mode: "email"; email: string }
  | {
      mode: "phone";
      mobileNumber: string;
      callingCode: string;
      country: string;
      phoneE164: string;
    }
  | { mode: "invalid"; message: string };

export function parseSmartContact(
  value: string,
  selectedValue: CountrySelection
): ParsedSmartContact {
  const trimmed = value.trim();
  const mode = detectSmartContactMode(trimmed);

  if (!trimmed) {
    return { mode: "invalid", message: "Email or phone number is required" };
  }

  if (mode === "email") {
    const email = trimmed.toLowerCase();
    if (!isValidEmail(email)) {
      return { mode: "invalid", message: "Enter a valid email address" };
    }
    return { mode: "email", email };
  }

  if (mode === "phone" || isPhoneLikeValue(trimmed)) {
    const callingCode = getCallingCode(selectedValue);
    const mobileNumber = normalizeNationalMobileInput(trimmed, callingCode);
    if (!mobileNumber) {
      return { mode: "invalid", message: "Enter a valid phone number" };
    }
    if (!isValidNationalMobileNumber(mobileNumber, callingCode)) {
      return {
        mode: "invalid",
        message: `Enter a valid ${selectedValue.name} phone number`,
      };
    }
    return {
      mode: "phone",
      mobileNumber,
      callingCode,
      country: selectedValue.name,
      phoneE164: toPhoneE164(mobileNumber, callingCode),
    };
  }

  return {
    mode: "invalid",
    message: "Enter a valid email or phone number",
  };
}
