import { cleanNumber } from "@/utils/functions/extrafunctions";
import mobileNumberLengths from "@/utils/mobileNumberLengths.json";

type MobileLengthEntry = {
  country: string;
  countryCode: string;
  mobileNumberLength: string;
};

const LENGTH_ENTRIES = mobileNumberLengths as MobileLengthEntry[];

/** Dial codes longest-first so +234 matches before +2 / +23. */
const DIAL_CODES = [
  ...new Set(
    LENGTH_ENTRIES.map((entry) => entry.countryCode.replace(/^\+/, ""))
  ),
].sort((a, b) => b.length - a.length);

function parseLengthRange(spec: string): { min: number; max: number } {
  if (spec.includes("-")) {
    const [minRaw, maxRaw] = spec.split("-");
    return { min: Number(minRaw), max: Number(maxRaw) };
  }
  const n = Number(spec);
  return { min: n, max: n };
}

function lengthRuleForCallingCode(callingCode: string): {
  min: number;
  max: number;
} | null {
  const code = callingCode.replace(/^\+/, "");
  const entry = LENGTH_ENTRIES.find(
    (item) => item.countryCode.replace(/^\+/, "") === code
  );
  if (!entry) return null;
  return parseLengthRange(entry.mobileNumberLength);
}

/** True when national digits match the expected length for the dial code. */
export function isValidNationalMobileNumber(
  nationalNumber: string,
  callingCode: string | string[] = "234"
): boolean {
  const code = Array.isArray(callingCode) ? callingCode[0] : callingCode;
  const digits = cleanNumber(nationalNumber);
  if (!digits) return false;

  const rule = lengthRuleForCallingCode(String(code));
  if (!rule) {
    return digits.length >= 7 && digits.length <= 12;
  }
  return digits.length >= rule.min && digits.length <= rule.max;
}

/**
 * Split an E.164 / digits phone into calling code + national number.
 * Fixes the previous `/^\+\d+/` strip that wiped the entire number.
 */
export function splitPhoneE164(phone: string): {
  callingCode: string;
  nationalNumber: string;
  e164: string;
} | null {
  const trimmed = phone.trim();
  if (!trimmed || trimmed.startsWith("email:")) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  for (const code of DIAL_CODES) {
    if (!digits.startsWith(code)) continue;
    const nationalNumber = digits.slice(code.length);
    if (!nationalNumber) continue;
    if (!isValidNationalMobileNumber(nationalNumber, code)) continue;
    return {
      callingCode: code,
      nationalNumber,
      e164: `+${code}${nationalNumber}`,
    };
  }

  // Unknown dial code / legacy row: keep full digits as E.164 body.
  return {
    callingCode: "",
    nationalNumber: digits,
    e164: `+${digits}`,
  };
}

/** National (local) digits from a stored E.164 or raw phone string. */
export function nationalNumberFromPhone(phone: string): string {
  return splitPhoneE164(phone)?.nationalNumber ?? "";
}

/**
 * Normalize local input: strip a duplicated dial code the user typed in
 * (e.g. country +234 + "2348132532430" → "8132532430").
 */
export function normalizeNationalMobileInput(
  rawLocal: string,
  callingCode: string | string[]
): string {
  const code = String(Array.isArray(callingCode) ? callingCode[0] : callingCode);
  let digits = cleanNumber(rawLocal);
  if (!digits) return "";

  if (
    digits.startsWith(code) &&
    digits.length > code.length &&
    isValidNationalMobileNumber(digits.slice(code.length), code)
  ) {
    digits = digits.slice(code.length);
  }

  return digits;
}

/** Canonical E.164-style value for API push registration (e.g. +2348012345678). */
export function toPhoneE164(
  localNumber: string,
  callingCode: string | string[] = "234"
): string {
  const code = Array.isArray(callingCode) ? callingCode[0] : callingCode;
  const digits = normalizeNationalMobileInput(localNumber, code);
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
