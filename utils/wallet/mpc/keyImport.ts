/**
 * Same-address MPC key import: split existing Ed25519 scalar into two shares
 * sk = sk_A + sk_B (mod L). Server never receives sk or mnemonic.
 *
 * Signing still uses the local mnemonic until a 2-party Ed25519 MPC coordinator
 * is wired; shares are stored so backend + device can adopt threshold signing later.
 */
import { getRandomValues } from "expo-crypto";
import { ed25519 } from "@noble/curves/ed25519";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

/** Ed25519 subgroup order (curve25519 scalar field). */
const L =
  2n ** 252n +
  2774231777737235353585193779088364840934564069179296858391505934104050317188864n;

function bytesToScalar(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    value = (value << 8n) + BigInt(bytes[i]);
  }
  return value % L;
}

function scalarToBytes(scalar: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let n = ((scalar % L) + L) % L;
  for (let i = 0; i < 32; i++) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

function randomScalar(): bigint {
  const buf = new Uint8Array(32);
  getRandomValues(buf);
  return bytesToScalar(buf);
}

function scalarFromKeypair(keypair: Keypair): bigint {
  const seed = keypair.secretKey.slice(0, 32);
  return bytesToScalar(seed);
}

function publicKeyFromScalar(scalar: bigint): Uint8Array {
  return ed25519.getPublicKey(scalarToBytes(scalar));
}

export interface KeyImportSplitResult {
  shareA: Uint8Array;
  shareB: Uint8Array;
  walletAddress: string;
}

export interface FreshKeypairSplitResult extends KeyImportSplitResult {
  keypair: Keypair;
}

/** Generate a new Solana keypair and split for seedless MPC (no mnemonic). */
export function generateFreshKeypairAndSplit(): FreshKeypairSplitResult {
  const keypair = Keypair.generate();
  return { ...splitKeypairForMpcImport(keypair), keypair };
}

/**
 * Split an existing Solana keypair into additive shares preserving the public key.
 */
export function splitKeypairForMpcImport(keypair: Keypair): KeyImportSplitResult {
  const sk = scalarFromKeypair(keypair);
  const skA = randomScalar();
  const skB = ((sk - skA) % L + L) % L;

  const expectedPub = keypair.publicKey.toBytes();
  const recomputedPub = publicKeyFromScalar((skA + skB) % L);

  if (Buffer.from(expectedPub).compare(Buffer.from(recomputedPub)) !== 0) {
    throw new Error("MPC key import failed: public key mismatch after split");
  }

  return {
    shareA: scalarToBytes(skA),
    shareB: scalarToBytes(skB),
    walletAddress: keypair.publicKey.toBase58(),
  };
}

export function encodeShareBase64(share: Uint8Array): string {
  return Buffer.from(share).toString("base64");
}

export function decodeShareBase64(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, "base64"));
}

/** Reconstruct Solana keypair from additive MPC shares (sk = A + B mod L). */
export function combineSharesToKeypair(shareA: Uint8Array, shareB: Uint8Array): Keypair {
  const sk = (bytesToScalar(shareA) + bytesToScalar(shareB)) % L;
  const skBytes = scalarToBytes(sk);
  const publicKey = ed25519.getPublicKey(skBytes);
  const secretKey = new Uint8Array(64);
  secretKey.set(skBytes, 0);
  secretKey.set(publicKey, 32);
  return Keypair.fromSecretKey(secretKey);
}

export function deriveWalletAddressFromShares(
  shareABase64: string,
  shareBBase64: string
): string {
  return combineSharesToKeypair(
    decodeShareBase64(shareABase64),
    decodeShareBase64(shareBBase64)
  ).publicKey.toBase58();
}

/** Sign a UTF-8 message with the wallet keypair (ownership proof). */
export function signOwnershipMessage(
  keypair: Keypair,
  message: string
): string {
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  return bs58.encode(signature);
}
