import nacl from "tweetnacl";
import { decodeShareBase64, encodeShareBase64 } from "@/utils/wallet/mpc/keyImport";

export interface DeviceLinkKeyPair {
  publicKeyBase64: string;
  secretKey: Uint8Array;
}

export function generateDeviceLinkKeyPair(): DeviceLinkKeyPair {
  const kp = nacl.box.keyPair();
  return {
    publicKeyBase64: Buffer.from(kp.publicKey).toString("base64"),
    secretKey: kp.secretKey,
  };
}

/** Primary device: encrypt Share A for the new device's public key (in transit only). */
export function encryptShareAForNewDevice(
  shareABase64: string,
  newDevicePublicKeyBase64: string
): string {
  const shareBytes = decodeShareBase64(shareABase64);
  const ephemeral = nacl.box.keyPair();
  const newDevicePub = new Uint8Array(Buffer.from(newDevicePublicKeyBase64, "base64"));
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box(shareBytes, nonce, newDevicePub, ephemeral.secretKey);
  if (!boxed) {
    throw new Error("Could not encrypt device share for linking");
  }
  return JSON.stringify({
    v: 1,
    ephPub: Buffer.from(ephemeral.publicKey).toString("base64"),
    nonce: Buffer.from(nonce).toString("base64"),
    cipher: Buffer.from(boxed).toString("base64"),
  });
}

/** New device: decrypt Share A from primary approval payload. */
export function decryptShareAFromPrimary(
  encryptedPayload: string,
  deviceSecretKey: Uint8Array
): string {
  const parsed = JSON.parse(encryptedPayload) as {
    ephPub: string;
    nonce: string;
    cipher: string;
  };
  const ephPub = new Uint8Array(Buffer.from(parsed.ephPub, "base64"));
  const nonce = new Uint8Array(Buffer.from(parsed.nonce, "base64"));
  const cipher = new Uint8Array(Buffer.from(parsed.cipher, "base64"));
  const opened = nacl.box.open(cipher, nonce, ephPub, deviceSecretKey);
  if (!opened) {
    throw new Error("Could not decrypt device share from primary phone");
  }
  return encodeShareBase64(opened);
}
