import * as Crypto from "expo-crypto";
import nacl from "tweetnacl";

export const WALLET_BACKUP_VERSION = 1 as const;

export type WalletBackupFile = {
  version: typeof WALLET_BACKUP_VERSION;
  username: string;
  walletAddress: string;
  salt: string;
  nonce: string;
  ciphertext: string;
  createdAt: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function deriveKey(pin: string, saltHex: string): Promise<Uint8Array> {
  let input = `${pin}:${saltHex}`;
  for (let i = 0; i < 5000; i++) {
    input = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      input,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
  }
  return fromHex(input);
}

export async function encryptWalletSecret(
  secret: string,
  pin: string
): Promise<Pick<WalletBackupFile, "salt" | "nonce" | "ciphertext">> {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = toHex(new Uint8Array(saltBytes));
  const key = await deriveKey(pin, salt);
  const nonceBytes = await Crypto.getRandomBytesAsync(
    nacl.secretbox.nonceLength
  );
  const nonce = new Uint8Array(nonceBytes);
  const message = new TextEncoder().encode(secret);
  const ciphertext = nacl.secretbox(message, nonce, key);
  if (!ciphertext) {
    throw new Error("Could not encrypt wallet backup");
  }
  return {
    salt,
    nonce: toHex(nonce),
    ciphertext: toHex(ciphertext),
  };
}

export async function decryptWalletSecret(
  payload: Pick<WalletBackupFile, "salt" | "nonce" | "ciphertext">,
  pin: string
): Promise<string> {
  const key = await deriveKey(pin, payload.salt);
  const decrypted = nacl.secretbox.open(
    fromHex(payload.ciphertext),
    fromHex(payload.nonce),
    key
  );
  if (!decrypted) {
    throw new Error("Invalid PIN or corrupted backup");
  }
  return new TextDecoder().decode(decrypted);
}
