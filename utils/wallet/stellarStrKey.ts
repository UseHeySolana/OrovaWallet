/**
 * Minimal Stellar StrKey encoder (version bytes + payload + CRC16).
 * Enough for generating G... / S... keys from ed25519 material.
 */

const VERSION_BYTES: Record<string, number> = {
  ed25519PublicKey: 6 << 3, // G
  ed25519SecretSeed: 18 << 3, // S
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function encode(
  version: keyof typeof VERSION_BYTES,
  payload: Uint8Array
): string {
  const versionByte = VERSION_BYTES[version];
  const raw = new Uint8Array(1 + payload.length + 2);
  raw[0] = versionByte;
  raw.set(payload, 1);
  const checksum = crc16xmodem(raw.subarray(0, payload.length + 1));
  raw[payload.length + 1] = checksum & 0xff;
  raw[payload.length + 2] = (checksum >> 8) & 0xff;
  return base32Encode(raw);
}
