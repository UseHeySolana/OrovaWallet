import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";

import type { VerifiedTokenDef } from "@/utils/tokenList/types";
import { DEFAULT_VERIFIED_TOKENS } from "@/utils/tokenList/defaultVerifiedTokens";

const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

function normalizeEntry(raw: unknown): VerifiedTokenDef | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const address = typeof o.address === "string" ? o.address.trim() : "";
    const symbol = typeof o.symbol === "string" ? o.symbol.trim() : "";
    const decimals =
        typeof o.decimals === "number" ? o.decimals : Number(o.decimals);
    const logo = typeof o.logo === "string" ? o.logo.trim() : "";
    if (!name || !isMint(address) || !symbol || !Number.isFinite(decimals)) {
        return null;
    }
    return {
        name,
        address,
        symbol,
        decimals: Math.max(0, Math.min(18, Math.floor(decimals))),
        logo: logo || "https://static.jup.ag/jup/icon.png",
    };
}

export function mergeVerifiedTokensByAddress(
    base: VerifiedTokenDef[],
    extra: VerifiedTokenDef[]
): VerifiedTokenDef[] {
    const map = new Map<string, VerifiedTokenDef>();
    for (const t of base) {
        map.set(t.address, t);
    }
    for (const t of extra) {
        map.set(t.address, t);
    }
    return Array.from(map.values());
}

type VerifiedTokensState = {
    tokens: VerifiedTokenDef[];
    setTokens: (tokens: VerifiedTokenDef[]) => void;
    resetToBundledDefaults: () => void;
};

export const useVerifiedTokensStore = create<VerifiedTokensState>()(
    persist<VerifiedTokensState>(
        (set) => ({
            tokens: DEFAULT_VERIFIED_TOKENS,
            setTokens: (tokens) => set({ tokens }),
            resetToBundledDefaults: () =>
                set({ tokens: [...DEFAULT_VERIFIED_TOKENS] }),
        }),
        {
            name: "verified-tokens-v1",
            storage: createJSONStorage(() => AsyncStorage),
            partialize: ((s) => ({ tokens: s.tokens })) as (
                s: VerifiedTokensState
            ) => VerifiedTokensState,
            merge: (persistedState, currentState) => {
                const nested =
                    persistedState &&
                    typeof persistedState === "object" &&
                    "state" in persistedState
                        ? (persistedState as { state?: { tokens?: VerifiedTokenDef[] } })
                              .state
                        : (persistedState as { tokens?: VerifiedTokenDef[] } | undefined);

                const stored = nested?.tokens;
                const tokens =
                    Array.isArray(stored) && stored.length > 0
                        ? mergeVerifiedTokensByAddress(
                              DEFAULT_VERIFIED_TOKENS,
                              stored
                          )
                        : [...DEFAULT_VERIFIED_TOKENS];

                return { ...currentState, tokens };
            },
        }
    )
);

/** Read the live list (always call this; do not cache a stale snapshot). */
export const getVerifiedTokens = (): VerifiedTokenDef[] =>
    useVerifiedTokensStore.getState().tokens;

/** Voice / system prompt: symbols only. */
export const getSupportedTokenSymbolsForPrompt = (): { name: string }[] =>
    getVerifiedTokens().map((item) => ({ name: item.symbol }));

/**
 * Optional remote JSON (GET). Set `EXPO_PUBLIC_VERIFIED_TOKENS_URL` to HTTPS URL
 * returning `{ "tokens": [ { name, address, symbol, decimals, logo? }, ... ] }`
 * or a bare array. Rows merge by mint; invalid rows skipped.
 */
export async function refreshVerifiedTokensFromRemote(): Promise<void> {
    const url = (process.env.EXPO_PUBLIC_VERIFIED_TOKENS_URL || "").trim();
    if (!url) return;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return;

    const json = await res.json();
    const list: unknown[] = Array.isArray(json)
        ? json
        : json &&
            typeof json === "object" &&
            Array.isArray((json as { tokens?: unknown }).tokens)
          ? ((json as { tokens: unknown[] }).tokens ?? [])
          : [];

    const parsed = list
        .map(normalizeEntry)
        .filter((x): x is VerifiedTokenDef => x !== null);

    if (parsed.length === 0) return;

    const next = mergeVerifiedTokensByAddress(
        DEFAULT_VERIFIED_TOKENS,
        parsed
    );
    useVerifiedTokensStore.getState().setTokens(next);
}

/** After app shell is ready: merge defaults + storage, then optional remote. */
export function bootstrapVerifiedTokensList(): void {
    const { tokens, setTokens } = useVerifiedTokensStore.getState();
    setTokens(mergeVerifiedTokensByAddress(DEFAULT_VERIFIED_TOKENS, tokens));
    void refreshVerifiedTokensFromRemote();
}
