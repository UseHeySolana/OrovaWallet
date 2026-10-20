import nacl from "tweetnacl";
import { encode as b32encode } from "@/utils/wallet/stellarStrKey";

/**
 * Lightweight Stellar keypair generation without pulling in the full SDK.
 * Public/secret keys use Stellar StrKey (ed25519).
 */
export async function generateStellarKeypair(): Promise<{
  publicKey: string;
  secret: string;
}> {
  const seed = nacl.randomBytes(32);
  const kp = nacl.sign.keyPair.fromSeed(seed);
  const publicKey = b32encode("ed25519PublicKey", kp.publicKey);
  const secret = b32encode("ed25519SecretSeed", seed);
  return { publicKey, secret };
}
