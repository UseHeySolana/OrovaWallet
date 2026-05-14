import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import { completeConversation } from "@/utils/functions";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import { searchTokenHitsV2, sortTokenSearchHitsForDisplay, tokenSearchHitsToPickerRows } from "@/libs/jupiter/tokensV2Search";
import Convo from "@/utils/store/conversation.store";

/**
 * Exposes Jupiter Tokens API v2 search to the assistant so users can look up
 * mints by name/symbol (e.g. "Trump token") without relying on the local allowlist.
 */
export class TokenSearchTool {
    public searchSplTokens: FunctionParams;

    constructor(public session: SessionManager) {
        this.searchSplTokens = this.search_spl_tokens();
    }

    private search_spl_tokens(): FunctionParams {
        return {
            name: "search_spl_tokens",
            owner: "HeySolana",
            description:
                "Search Solana SPL tokens by name, symbol, or mint using Jupiter Tokens API v2. Use when the user asks for a token mint, wants to find a coin by name (e.g. Trump, JUP), verify a symbol, or explore matches before swapping. Returns multiple candidates when ambiguous.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description:
                            "Search text: token name, ticker symbol, or full mint address",
                    },
                },
                required: ["query"],
            },
            handler: async (args: { query: string }) => {
                const messageId = this.session.functionMessageId;
                const q = (args.query || "").trim();
                if (!q) {
                    if (messageId !== null) {
                        completeConversation(messageId, "failed");
                    }
                    return "Please provide a token name, symbol, or mint to search.";
                }

                const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
                if (!key) {
                    if (messageId !== null) {
                        completeConversation(messageId, "failed");
                    }
                    return "Token search is unavailable: add EXPO_PUBLIC_JUP_API_KEY for Jupiter API access.";
                }

                const rawHits = await searchTokenHitsV2(q);
                if (rawHits.length === 0) {
                    if (messageId !== null) {
                        completeConversation(messageId, "complete");
                    }
                    return await convertSpeech(
                        `No tokens matched "${q}". Try a different spelling, the ticker symbol, or paste the mint address if you have it.`
                    );
                }

                const hits = sortTokenSearchHitsForDisplay(rawHits).slice(0, 15);

                if (messageId !== null && hits.length > 1) {
                    const existing = Convo.getState().messages.find((m) => m.id === messageId);
                    Convo.getState().updateMessage({
                        messageId,
                        source: existing?.source ?? "voice",
                        content: {
                            messageType: "token_search",
                            tokenSearchPicker: {
                                query: q,
                                hits: tokenSearchHitsToPickerRows(hits),
                            },
                        },
                    });
                }

                if (hits.length === 1) {
                    const h = hits[0]!;
                    const line = `${h.meta.symbol} — ${h.meta.name}\nMint: ${h.meta.address}\nDecimals: ${h.meta.decimals}${h.isVerified ? "\n(verified)" : ""}`;
                    if (messageId !== null) {
                        completeConversation(messageId, "complete");
                    }
                    return await convertSpeech(
                        `Best match for "${q}":\n\n${line}`
                    );
                }

                const lines = hits.map((h, i) => {
                    const v = h.isVerified ? " · verified" : "";
                    const score =
                        typeof h.organicScore === "number" &&
                        !Number.isNaN(h.organicScore)
                            ? ` · organic ${h.organicScore.toFixed(0)}`
                            : "";
                    return `${i + 1}. ${h.meta.symbol} — ${h.meta.name}${v}${score}\n   Mint: ${h.meta.address}`;
                });

                const summary = [
                    `Found ${rawHits.length} match(es) for "${q}". Verified matches are listed first in the picker below—tap the token you want, or tell me its mint.`,
                    "",
                    ...lines,
                ].join("\n");

                if (messageId !== null) {
                    completeConversation(messageId, "complete");
                }
                return await convertSpeech(summary);
            },
        };
    }
}
