export const QVAC_PAIRING_PREFIX = "heysolana-qvac://";

/**
 * Extract a QVAC provider public key from a pasted value or pairing URL/QR payload.
 * Returns null when the input is empty or invalid.
 */
export function parseQvacPairingPayload(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(QVAC_PAIRING_PREFIX)) {
    const key = trimmed.slice(QVAC_PAIRING_PREFIX.length).trim();
    return key || null;
  }

  return trimmed;
}
