import type { VerifiedTokenDef } from "@/utils/tokenList/types";
import type { TokenSearchPickRow } from "@/utils/store/conversation.store";
import { getVerifiedTokens } from "@/utils/store/verifiedTokens.store";
import { pushDevNetworkLog } from "@/utils/store/devNetworkLog.store";

const TOKENS_V2_BASE = "https://api.jup.ag/tokens/v2";
const SEARCH_URL = `${TOKENS_V2_BASE}/search`;

const jupHeaders = (): HeadersInit => ({
    Accept: "application/json",
    "x-api-key": (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim(),
});

const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

type JupiterTokenRow = {
    id?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    icon?: string;
    isVerified?: boolean;
    organicScore?: number;
};

export type TokenSearchHit = {
    meta: VerifiedTokenDef;
    isVerified?: boolean;
    organicScore?: number;
};

function rowToHit(row: JupiterTokenRow): TokenSearchHit | null {
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!isMint(id)) return null;
    const symbol = typeof row.symbol === "string" ? row.symbol.trim() : "";
    const name =
        (typeof row.name === "string" ? row.name.trim() : "") ||
        symbol ||
        "Unknown";
    const d =
        typeof row.decimals === "number" ? row.decimals : Number(row.decimals);
    if (!symbol || !Number.isFinite(d)) return null;
    const icon = typeof row.icon === "string" ? row.icon.trim() : "";
    return {
        meta: {
            name,
            address: id,
            symbol,
            decimals: Math.max(0, Math.min(18, Math.floor(d))),
            logo: icon || "https://static.jup.ag/jup/icon.png",
        },
        isVerified: row.isVerified === true,
        organicScore:
            typeof row.organicScore === "number"
                ? row.organicScore
                : Number(row.organicScore),
    };
}

async function fetchJupiterTokenRows(
    url: string,
    logLabel: string
): Promise<TokenSearchHit[]> {
    const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
    if (!key) return [];

    const startedAt = Date.now();
    const res = await fetch(url, { headers: jupHeaders() });
    const text = await res.text();
    if (__DEV__) {
        pushDevNetworkLog({
            label: logLabel,
            method: "GET",
            url,
            status: res.status,
            durationMs: Date.now() - startedAt,
            responseBody: text,
        });
    }
    if (!res.ok) return [];

    let json: unknown;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        return [];
    }
    if (!Array.isArray(json)) return [];

    const hits: TokenSearchHit[] = [];
    for (const row of json as JupiterTokenRow[]) {
        const h = rowToHit(row);
        if (h) hits.push(h);
    }
    return hits;
}

/** Jupiter Tokens v2 verified tag list. */
export async function fetchVerifiedTokenHitsV2(): Promise<TokenSearchHit[]> {
    return fetchJupiterTokenRows(
        `${TOKENS_V2_BASE}/tag?query=verified`,
        "Jupiter tokens v2 /tag verified"
    );
}

/** Jupiter Tokens v2 top organic score (24h). */
export async function fetchTopOrganicTokenHitsV2(
    limit = 50
): Promise<TokenSearchHit[]> {
    return fetchJupiterTokenRows(
        `${TOKENS_V2_BASE}/toporganicscore/24h?limit=${limit}`,
        "Jupiter tokens v2 /toporganicscore"
    );
}

/**
 * Swap picker browse: search when query is set, otherwise verified Jupiter tokens
 * (fallback to top organic if verified is empty).
 */
export async function browseTokenHitsForSwap(
    query: string
): Promise<TokenSearchHit[]> {
    const q = query.trim();
    if (q) {
        const hits = await searchTokenHitsV2(q);
        return sortTokenSearchHitsForDisplay(hits).slice(0, 50);
    }

    const verified = await fetchVerifiedTokenHitsV2();
    const sorted = sortTokenSearchHitsForDisplay(verified);
    if (sorted.length > 0) return sorted.slice(0, 100);

    const top = await fetchTopOrganicTokenHitsV2(50);
    return sortTokenSearchHitsForDisplay(top);
}

/** Raw Jupiter search; returns empty if no API key or bad response. */
export async function searchTokenHitsV2(query: string): Promise<TokenSearchHit[]> {
    const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
    if (!key) return [];

    const q = query.trim();
    if (!q) return [];

    const url = `${SEARCH_URL}?query=${encodeURIComponent(q)}`;
    const startedAt = Date.now();
    const res = await fetch(url, { headers: jupHeaders() });
    const text = await res.text();
    if (__DEV__) {
        pushDevNetworkLog({
            label: "Jupiter tokens v2 /search",
            method: "GET",
            url,
            status: res.status,
            durationMs: Date.now() - startedAt,
            requestSummary: `query=${q}`,
            responseBody: text,
        });
    }
    if (!res.ok) return [];

    let json: unknown;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        return [];
    }
    if (!Array.isArray(json)) return [];

    const hits: TokenSearchHit[] = [];
    for (const row of json as JupiterTokenRow[]) {
        const h = rowToHit(row);
        if (h) hits.push(h);
    }
    return hits;
}

/** Verified first, then higher organic score (for picker UI). */
export function sortTokenSearchHitsForDisplay(
    hits: TokenSearchHit[]
): TokenSearchHit[] {
    return [...hits].sort((a, b) => {
        const va = a.isVerified === true ? 1 : 0;
        const vb = b.isVerified === true ? 1 : 0;
        if (vb !== va) return vb - va;
        const sa =
            typeof a.organicScore === "number" && !Number.isNaN(a.organicScore)
                ? a.organicScore
                : -1;
        const sb =
            typeof b.organicScore === "number" && !Number.isNaN(b.organicScore)
                ? b.organicScore
                : -1;
        return sb - sa;
    });
}

/** Map Jupiter search hits to rows stored on the tool message for TokenSearchPicker. */
export function tokenSearchHitsToPickerRows(
    hits: TokenSearchHit[]
): TokenSearchPickRow[] {
    return hits.map((h) => ({
        mint: h.meta.address,
        symbol: h.meta.symbol,
        name: h.meta.name,
        decimals: h.meta.decimals,
        logo: h.meta.logo,
        isVerified: h.isVerified === true,
        organicScore:
            typeof h.organicScore === "number" &&
            !Number.isNaN(h.organicScore)
                ? h.organicScore
                : undefined,
    }));
}

function pickBestHit(hits: TokenSearchHit[], rawQuery: string): TokenSearchHit | null {
    if (hits.length === 0) return null;
    const q = rawQuery.trim();
    const qLower = q.toLowerCase();

    if (isMint(q)) {
        return hits.find((h) => h.meta.address === q) ?? hits[0] ?? null;
    }

    const exact = hits.filter(
        (h) => h.meta.symbol.toLowerCase() === qLower
    );
    if (exact.length === 1) return exact[0]!;

    if (exact.length > 1) {
        const verified = exact.find((h) => h.isVerified);
        if (verified) return verified;
        return [...exact].sort(
            (a, b) => (b.organicScore ?? -1) - (a.organicScore ?? -1)
        )[0]!;
    }

    const anyVerified = hits.find((h) => h.isVerified);
    if (anyVerified) return anyVerified;

    return [...hits].sort(
        (a, b) => (b.organicScore ?? -1) - (a.organicScore ?? -1)
    )[0]!;
}

export type SwapTokenResolveResult =
    | { kind: "none" }
    | { kind: "one"; meta: VerifiedTokenDef }
    | { kind: "many"; query: string; hits: TokenSearchHit[] };

/**
 * Resolve a token for swap/quote UX: if Jupiter returns several plausible matches
 * for a non-mint query, return `many` so the UI can show a picker (verified first).
 * Does not auto-pick when ambiguous.
 */
export async function resolveTokenForSwapDisambiguation(
    rawQuery: string
): Promise<SwapTokenResolveResult> {
    const trimmed = rawQuery.trim();
    if (!trimmed) return { kind: "none" };

    const local = getVerifiedTokens();
    if (isMint(trimmed)) {
        const byMint = local.find((t) => t.address === trimmed);
        if (byMint) return { kind: "one", meta: byMint };
    } else {
        const bySym = local.find(
            (t) => t.symbol.toLowerCase() === trimmed.toLowerCase()
        );
        if (bySym) return { kind: "one", meta: bySym };
    }

    const rawHits = await searchTokenHitsV2(trimmed);
    const sorted = sortTokenSearchHitsForDisplay(rawHits);
    if (sorted.length === 0) return { kind: "none" };

    if (isMint(trimmed)) {
        const m = sorted.find((h) => h.meta.address === trimmed);
        if (m) return { kind: "one", meta: m.meta };
        return { kind: "none" };
    }

    const qLower = trimmed.toLowerCase();
    const exactSym = sorted.filter(
        (h) => h.meta.symbol.toLowerCase() === qLower
    );
    if (exactSym.length > 1) {
        return { kind: "many", query: trimmed, hits: exactSym.slice(0, 15) };
    }
    if (exactSym.length === 1) {
        return { kind: "one", meta: exactSym[0]!.meta };
    }

    if (sorted.length > 1) {
        return { kind: "many", query: trimmed, hits: sorted.slice(0, 15) };
    }
    return { kind: "one", meta: sorted[0]!.meta };
}

/**
 * Resolve a user-provided symbol, name fragment, or mint to token metadata.
 * Tries persisted/local list first, then Jupiter Tokens v2 search.
 */
export async function resolveTokenByQuery(
    rawQuery: string
): Promise<VerifiedTokenDef | null> {
    const trimmed = rawQuery.trim();
    if (!trimmed) return null;

    const local = getVerifiedTokens();
    if (isMint(trimmed)) {
        const hit = local.find((t) => t.address === trimmed);
        if (hit) return hit;
    } else {
        const hit = local.find(
            (t) => t.symbol.toLowerCase() === trimmed.toLowerCase()
        );
        if (hit) return hit;
    }

    const hits = await searchTokenHitsV2(trimmed);
    const best = pickBestHit(hits, trimmed);
    return best?.meta ?? null;
}

const BATCH = 90;

/** Batch-resolve mints (comma-separated search, up to ~100 mints per Jupiter docs). */
export async function resolveMetasForMints(
    mints: string[]
): Promise<Map<string, VerifiedTokenDef>> {
    const out = new Map<string, VerifiedTokenDef>();
    const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
    if (!key) return out;

    const unique = [...new Set(mints.filter((m) => isMint(m)))];
    const local = getVerifiedTokens();
    for (const m of unique) {
        const hit = local.find((t) => t.address === m);
        if (hit) out.set(m, hit);
    }
    const need = unique.filter((m) => !out.has(m));
    for (let i = 0; i < need.length; i += BATCH) {
        const chunk = need.slice(i, i + BATCH);
        if (chunk.length === 0) continue;
        const hits = await searchTokenHitsV2(chunk.join(","));
        for (const h of hits) {
            out.set(h.meta.address, h.meta);
        }
    }
    return out;
}
