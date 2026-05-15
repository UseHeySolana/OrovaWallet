import * as Crypto from "expo-crypto";
import nacl from "tweetnacl";
import { decodeShareBase64, encodeShareBase64 } from "@/utils/wallet/mpc/keyImport";
import type { AuthenticationExtensionsPRFOutputsJSON } from "react-native-passkeys/build/ReactNativePasskeys.types";

const PRF_SALT_DOMAIN = "heysolana-mpc-share-a-prf-v1:";

/** Deterministic PRF salt (base64url) bound to wallet address — same on every device. */
export async function getPrfSaltBase64Url(walletAddress: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PRF_SALT_DOMAIN}${walletAddress.trim()}`
  );
  const bytes = hexToBytes(digest);
  return bytesToBase64Url(bytes);
}

export function prfExtensionInput(walletAddress: string): Promise<{ prf: { eval: { first: string } } }> {
  return getPrfSaltBase64Url(walletAddress).then((first) => ({
    prf: { eval: { first } },
  }));
}

function bytesFromPrfValue(first: unknown): Uint8Array | null {
  if (first == null) return null;
  if (first instanceof ArrayBuffer) {
    const bytes = new Uint8Array(first);
    if (bytes.length < 32) return null;
    return bytes.slice(0, 32);
  }
  if (first instanceof Uint8Array) {
    if (first.length < 32) return null;
    return first.slice(0, 32);
  }
  if (typeof first === "string") {
    try {
      const key = base64UrlToBytes(first);
      if (key.length < 32) return null;
      return key.slice(0, 32);
    } catch {
      try {
        const key = new Uint8Array(Buffer.from(first, "base64"));
        if (key.length < 32) return null;
        return key.slice(0, 32);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** 32-byte key material from WebAuthn PRF extension output. */
export function prfKeyFromExtensionOutput(
  prfOut: AuthenticationExtensionsPRFOutputsJSON | undefined
): Uint8Array | null {
  if (!prfOut) return null;
  const fromResults = bytesFromPrfValue(prfOut.results?.first);
  if (fromResults) return fromResults;
  return null;
}

export function encryptShareAWithPrfKey(shareABase64: string, prfKey: Uint8Array): string {
  if (prfKey.length !== 32) {
    throw new Error("PRF key must be 32 bytes");
  }
  const plaintext = decodeShareBase64(shareABase64);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(plaintext, nonce, prfKey);
  if (!cipher) {
    throw new Error("Could not encrypt device share with passkey");
  }
  return JSON.stringify({
    v: 1,
    alg: "nacl-secretbox-prf-v1",
    nonce: bytesToBase64(Buffer.from(nonce)),
    cipher: bytesToBase64(Buffer.from(cipher)),
  });
}

export function decryptShareAWithPrfKey(payload: string, prfKey: Uint8Array): string {
  if (prfKey.length !== 32) {
    throw new Error("PRF key must be 32 bytes");
  }
  const parsed = JSON.parse(payload) as {
    v: number;
    nonce: string;
    cipher: string;
  };
  if (parsed.v !== 1) {
    throw new Error("Unsupported Share A backup version");
  }
  const nonce = new Uint8Array(Buffer.from(parsed.nonce, "base64"));
  const cipher = new Uint8Array(Buffer.from(parsed.cipher, "base64"));
  const opened = nacl.secretbox.open(cipher, nonce, prfKey);
  if (!opened) {
    throw new Error("Passkey could not decrypt device share — wrong account or outdated backup");
  }
  return encodeShareBase64(opened);
}

export function isPrfEncryptedShareAPayload(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const t = value.trim();
  return t.startsWith('{"v":1') && t.includes("nacl-secretbox-prf-v1");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(Buffer.from(bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function bytesToBase64(buf: Buffer): string {
  return buf.toString("base64");
}
