import { pushDevNetworkLog } from "@/utils/store/devNetworkLog.store";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const jupHeaders = (): HeadersInit => ({
    Accept: "application/json",
    "x-api-key": (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim(),
});

/** Quote-only GET /order (no taker) — same shape as `check_price`. */
export async function runDevSampleSwapV2Quote(): Promise<string> {
    const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
    if (!key) {
        return "Missing EXPO_PUBLIC_JUP_API_KEY — add it to .env and restart Metro.";
    }
    const params = new URLSearchParams({
        inputMint: SOL,
        outputMint: USDC,
        amount: "1000000",
        swapMode: "ExactIn",
        slippageBps: "50",
    });
    const url = `https://api.jup.ag/swap/v2/order?${params.toString()}`;
    const started = Date.now();
    const res = await fetch(url, { method: "GET", headers: jupHeaders() });
    const text = await res.text();
    pushDevNetworkLog({
        label: "Dev sample: Jupiter swap v2 /order (quote only)",
        method: "GET",
        url,
        status: res.status,
        durationMs: Date.now() - started,
        requestSummary: params.toString(),
        responseBody: text,
    });
    return res.ok
        ? "Logged swap v2 quote response. Open the entry for full body."
        : `Request finished with HTTP ${res.status}. Body logged.`;
}

/** Jupiter Tokens API v2 search (same as in-app token search). */
export async function runDevSampleTokenSearch(): Promise<string> {
    const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
    if (!key) {
        return "Missing EXPO_PUBLIC_JUP_API_KEY — add it to .env and restart Metro.";
    }
    const url = `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent("USDC")}`;
    const started = Date.now();
    const res = await fetch(url, { method: "GET", headers: jupHeaders() });
    const text = await res.text();
    pushDevNetworkLog({
        label: "Dev sample: Jupiter tokens v2 /search",
        method: "GET",
        url,
        status: res.status,
        durationMs: Date.now() - started,
        requestSummary: "query=USDC",
        responseBody: text,
    });
    return res.ok
        ? "Logged token search response."
        : `Request finished with HTTP ${res.status}. Body logged.`;
}
