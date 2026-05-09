/**
 * MagicBlock Private Payments auth flow.
 *
 * Endpoints that read or write data inside the Private Ephemeral Rollup
 * require a short-lived bearer token. To obtain one we:
 *   1. GET /v1/spl/challenge?pubkey=<wallet>            -> { challenge }
 *   2. Sign the challenge bytes with the wallet keypair (ed25519).
 *   3. POST /v1/spl/login { pubkey, challenge, signature } -> { token }
 *
 * Tokens are cached per (pubkey, cluster) in a zustand store so we don't
 * re-prompt the user. Callers should invoke `getMagicBlockToken({ force })`
 * whenever they receive a 401 from the API.
 */

import nacl from "tweetnacl";
// bs58 ships without TypeScript declarations; declare a minimal ambient module here.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import bs58 from "bs58";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { keypairSign } from "@/utils/functions/extrafunctions";
import { magicblock, MbCluster } from "./magicblock";

interface CachedToken {
  token: string;
  pubkey: string;
  cluster: MbCluster;
  issuedAt: number;
}

interface MagicBlockAuthStore {
  tokens: Record<string, CachedToken>;
  setToken: (key: string, value: CachedToken) => void;
  clearToken: (key: string) => void;
  clearAll: () => void;
}

const tokenKey = (pubkey: string, cluster: MbCluster) => `${cluster}:${pubkey}`;

const MagicBlockAuth = create<MagicBlockAuthStore>()(
  persist(
    (set) => ({
      tokens: {},
      setToken: (key, value) =>
        set((state) => ({ tokens: { ...state.tokens, [key]: value } })),
      clearToken: (key) =>
        set((state) => {
          const next = { ...state.tokens };
          delete next[key];
          return { tokens: next };
        }),
      clearAll: () => set({ tokens: {} }),
    }),
    {
      name: "magicblock-auth",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Tokens older than this are treated as expired and re-issued. */
const TOKEN_TTL_MS = 1000 * 60 * 30;

const isFresh = (cached: CachedToken | undefined) => {
  if (!cached) return false;
  return Date.now() - cached.issuedAt < TOKEN_TTL_MS;
};

export const clearMagicBlockTokens = () => {
  MagicBlockAuth.getState().clearAll();
};

/**
 * Resolve a bearer token for the connected wallet. Will reuse a cached
 * token unless `force` is true or the cache is stale.
 *
 * Throws if the wallet is not connected or if signing/login fails.
 */
export const getMagicBlockToken = async (opts: {
  cluster: MbCluster;
  force?: boolean;
}): Promise<string> => {
  const { cluster, force } = opts;
  const kp = await keypairSign();
  if (!kp) throw new Error("Wallet is not connected");

  const pubkey = kp.publicKey.toBase58();
  const key = tokenKey(pubkey, cluster);
  const cached = MagicBlockAuth.getState().tokens[key];

  if (!force && isFresh(cached)) {
    return cached.token;
  }

  const challengeRes = await magicblock.challenge(pubkey, cluster);
  if (!challengeRes.status) {
    throw new Error(`Failed to fetch challenge: ${challengeRes.message}`);
  }
  const { challenge } = challengeRes.data;

  const message = new TextEncoder().encode(challenge);
  const signature = nacl.sign.detached(message, kp.secretKey);
  const signatureB58 = bs58.encode(signature);

  const loginRes = await magicblock.login({
    pubkey,
    challenge,
    signature: signatureB58,
    cluster,
  });
  if (!loginRes.status) {
    throw new Error(`Login failed: ${loginRes.message}`);
  }

  const cachedEntry: CachedToken = {
    token: loginRes.data.token,
    pubkey,
    cluster,
    issuedAt: Date.now(),
  };
  MagicBlockAuth.getState().setToken(key, cachedEntry);

  return cachedEntry.token;
};

export default MagicBlockAuth;
