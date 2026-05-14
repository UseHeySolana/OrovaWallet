import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import {
    convertSpeech,
    signTransactions,
    signVersionedTxFromBase64,
} from "@/utils/functions/extrafunctions";
import { confirm } from "@/services/confirmation";
import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import Convo from "@/utils/store/conversation.store";
import {
    completeConversation,
    resolveTokenForSwapDisambiguation,
    tokenSearchHitsToPickerRows,
} from "@/utils/functions";
import type { TokenSearchHit } from "@/libs/jupiter/tokensV2Search";
import { pushDevNetworkLog } from "@/utils/store/devNetworkLog.store";

const JUPITER_SWAP_V2 = "https://api.jup.ag/swap/v2";

const jupSwapV2Headers = (): HeadersInit => ({
    Accept: "application/json",
    "x-api-key": (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim(),
});

type JupiterSwapV2Order = {
    transaction?: string | null;
    requestId?: string;
    lastValidBlockHeight?: string;
    inAmount?: string;
    outAmount?: string;
    errorCode?: number;
    errorMessage?: string;
    error?: string;
};

type JupiterSwapV2ExecuteResult = {
    status?: string;
    signature?: string;
    slot?: string;
    error?: string;
    code?: number;
};

async function readJsonBody(
    res: Response,
    log?: {
        label: string;
        method: string;
        url: string;
        requestSummary?: string;
        startedAt: number;
    }
): Promise<{
    ok: boolean;
    data: JupiterSwapV2Order | null;
    message: string;
}> {
    const text = await res.text();
    if (__DEV__ && log) {
        pushDevNetworkLog({
            label: log.label,
            method: log.method,
            url: log.url,
            status: res.status,
            durationMs: Date.now() - log.startedAt,
            requestSummary: log.requestSummary,
            responseBody: text,
        });
    }
    try {
        const data = text ? (JSON.parse(text) as JupiterSwapV2Order) : null;
        if (!res.ok) {
            const err =
                (data as { error?: string; message?: string } | null)?.error ||
                (data as { message?: string } | null)?.message ||
                text.slice(0, 240) ||
                `HTTP ${res.status}`;
            return { ok: false, data: null, message: err };
        }
        return { ok: true, data, message: "" };
    } catch {
        return {
            ok: false,
            data: null,
            message: text.slice(0, 240) || `HTTP ${res.status}`,
        };
    }
}

/**
 * Jupiter Swap API v2 GET /order. Amount is smallest units of **input** (ExactIn only in v2).
 * Omit `taker` for quote-only (no serialized transaction).
 */
const getSwapV2Order = async (params: {
    inputMint: string;
    outputMint: string;
    amountSmallestInput: string;
    taker?: string;
    slippageBps?: number;
}): Promise<{ status: boolean; data?: JupiterSwapV2Order; message: string }> => {
    const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
    if (!key) {
        return {
            status: false,
            message: "Set EXPO_PUBLIC_JUP_API_KEY for Jupiter Swap API v2.",
        };
    }

    if (!params.inputMint || !params.outputMint || !params.amountSmallestInput) {
        return { status: false, message: "Invalid swap parameters" };
    }

    const search = new URLSearchParams({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amountSmallestInput,
        swapMode: "ExactIn",
    });
    if (params.taker) search.set("taker", params.taker);
    if (params.slippageBps != null && params.slippageBps >= 0) {
        search.set("slippageBps", String(params.slippageBps));
    }

    try {
        const orderUrl = `${JUPITER_SWAP_V2}/order?${search.toString()}`;
        const startedAt = Date.now();
        const res = await fetch(orderUrl, {
            method: "GET",
            headers: jupSwapV2Headers(),
        });
        const parsed = await readJsonBody(res, {
            label: "Jupiter swap v2 /order",
            method: "GET",
            url: orderUrl,
            requestSummary: search.toString(),
            startedAt,
        });
        if (!parsed.ok || !parsed.data) {
            return { status: false, message: parsed.message || "Swap order failed" };
        }
        const d = parsed.data;
        if (params.taker) {
            if (d.errorCode != null && d.errorCode !== 0) {
                return {
                    status: false,
                    message: d.errorMessage || d.error || "Could not build swap transaction",
                };
            }
            if (!d.transaction || d.transaction.length === 0) {
                return {
                    status: false,
                    message: d.errorMessage || d.error || "No transaction in Jupiter response",
                };
            }
        }
        return { status: true, data: d };
    } catch (e) {
        console.error("Jupiter swap v2 /order error:", e);
        return {
            status: false,
            message: (e as Error).message || "Failed to reach Jupiter Swap API",
        };
    }
};

/**
 * Jupiter Swap API v2 POST /execute — broadcast + landing via Jupiter (requires requestId from /order).
 */
const postSwapV2Execute = async (params: {
    signedTransaction: string;
    requestId: string;
    lastValidBlockHeight?: string;
}): Promise<{ status: boolean; data?: JupiterSwapV2ExecuteResult; message: string }> => {
    const key = (process.env.EXPO_PUBLIC_JUP_API_KEY || "").trim();
    if (!key) {
        return {
            status: false,
            message: "Set EXPO_PUBLIC_JUP_API_KEY for Jupiter Swap API v2.",
        };
    }

    const url = `${JUPITER_SWAP_V2}/execute`;
    const body: Record<string, string> = {
        signedTransaction: params.signedTransaction,
        requestId: params.requestId,
    };
    if (params.lastValidBlockHeight) {
        body.lastValidBlockHeight = params.lastValidBlockHeight;
    }

    const startedAt = Date.now();
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                ...jupSwapV2Headers(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        if (__DEV__) {
            pushDevNetworkLog({
                label: "Jupiter swap v2 /execute",
                method: "POST",
                url,
                status: res.status,
                durationMs: Date.now() - startedAt,
                requestSummary: `requestId=${params.requestId}`,
                responseBody: text,
            });
        }

        let data: JupiterSwapV2ExecuteResult | null = null;
        try {
            data = text ? (JSON.parse(text) as JupiterSwapV2ExecuteResult) : null;
        } catch {
            return {
                status: false,
                message: text.slice(0, 280) || "Invalid JSON from Jupiter /execute",
            };
        }

        if (!res.ok) {
            return {
                status: false,
                message: data?.error || text.slice(0, 240) || `HTTP ${res.status}`,
            };
        }

        if (data?.status === "Failed" || !data?.signature) {
            return {
                status: false,
                message:
                    data?.error ||
                    (data?.code != null
                        ? `Execute failed (code ${data.code})`
                        : "Execute failed"),
            };
        }

        return { status: true, data };
    } catch (e) {
        console.error("Jupiter swap v2 /execute error:", e);
        return {
            status: false,
            message: (e as Error).message || "Failed to reach Jupiter /execute",
        };
    }
};

export class SwapFunction {
    public swapFunction: FunctionParams;
    public checkPrice: FunctionParams;

    constructor(public session: SessionManager) {
        this.swapFunction = this.swap_tokens()
        this.checkPrice = this.check_price()
    }
    swap_tokens() {
        return {
            name: "swap_tokens",
            owner: "HeySolana",
            description:
                "Execute a token swap on Solana via Jupiter. fromToken and toToken are ANY symbols or mint strings the user names—the handler resolves them with Jupiter Tokens API v2 (not a fixed app list). If several tokens match a symbol, the app shows a picker on this tool card (verified first); prefer that over asking the user to type a mint. Always call this tool for swap requests; do not refuse because a token was not listed in chat context.",
            parameters: {
                type: "object",
                properties: {
                    amount: {
                        type: "number",
                        description:
                            "Human amount of fromToken to sell (ExactIn). Jupiter Swap API v2 returns how much toToken you receive for that input.",
                    },
                    fromToken: {
                        type: "string",
                        description: "Token you sell: symbol (e.g. SOL) or mint address; resolved via Jupiter token search.",
                    },
                    toToken: {
                        type: "string",
                        description: "Token you buy: symbol or mint address; resolved via Jupiter token search.",
                    },
                },
                required: ["amount", "fromToken", "toToken"],
            },
            handler: async (args: { amount: number, fromToken: string, toToken: string }) => {

                const { amount, fromToken, toToken } = args;
                const messageId = this.session.functionMessageId

                const fail = async (msg: string) => {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return msg;
                };

                const fromRes = await resolveTokenForSwapDisambiguation(fromToken);
                const toRes = await resolveTokenForSwapDisambiguation(toToken);

                if (fromRes.kind === "none" || toRes.kind === "none") {
                    return fail("Could not resolve one or both tokens. Try a mint address, or set EXPO_PUBLIC_JUP_API_KEY for Jupiter token search.");
                }

                let picker: { leg: "from" | "to"; query: string; hits: TokenSearchHit[] } | null = null;
                if (fromRes.kind === "many") {
                    picker = { leg: "from", query: fromRes.query, hits: fromRes.hits };
                } else if (toRes.kind === "many") {
                    picker = { leg: "to", query: toRes.query, hits: toRes.hits };
                }

                if (picker !== null) {
                    if (messageId === null) {
                        return "Several tokens matched; I need the in-chat tool card to show the picker. Try again from chat, or paste a mint address for the token you want.";
                    }
                    const existing = Convo.getState().messages.find((m) => m.id === messageId);
                    Convo.getState().updateMessage({
                        messageId,
                        source: existing?.source ?? "voice",
                        content: {
                            messageType: "token_search",
                            tokenSearchPicker: {
                                query: picker.query,
                                hits: tokenSearchHitsToPickerRows(picker.hits),
                                swapLeg: picker.leg,
                            },
                        },
                    });
                    completeConversation(messageId, "complete");
                    const legPhrase =
                        picker.leg === "from"
                            ? "token you're selling (fromToken)"
                            : "token you're buying (toToken)";
                    const bothNote =
                        fromRes.kind === "many" && toRes.kind === "many"
                            ? " After you pick this side, ask for the same swap again so we can choose the other token."
                            : "";
                    return await convertSpeech(
                        `Several tokens matched for the ${legPhrase}. Tap the right one in the list under this card.${bothNote}`
                    );
                }

                if (fromRes.kind !== "one" || toRes.kind !== "one") {
                    return fail("Could not resolve one or both tokens. Try a mint address, or set EXPO_PUBLIC_JUP_API_KEY for Jupiter token search.");
                }

                const fromMint = fromRes.meta;
                const toMint = toRes.meta;

                const userPublicKey = WalletItem.getState().publicKey;
                if (!userPublicKey) {
                    return fail("Wallet not connected.");
                }

                const fromDecimals = fromMint.decimals ?? 0;
                const toDecimals = toMint.decimals ?? 0;
                const amountSmallest = Math.round(
                    amount * Math.pow(10, fromDecimals)
                );
                if (!Number.isFinite(amountSmallest) || amountSmallest <= 0) {
                    return fail("Invalid swap amount.");
                }

                const orderRes = await getSwapV2Order({
                    inputMint: fromMint.address,
                    outputMint: toMint.address,
                    amountSmallestInput: String(amountSmallest),
                    taker: userPublicKey.toString(),
                    slippageBps: 50,
                });
                if (!orderRes.status || !orderRes.data?.transaction) {
                    if (messageId !== null) {
                        completeConversation(messageId, "failed");
                    }
                    return orderRes.message;
                }

                const orderData = orderRes.data;
                const requestId =
                    typeof orderData.requestId === "string" &&
                    orderData.requestId.length > 0
                        ? orderData.requestId
                        : null;

                if (requestId) {
                    const userApproved = await confirm({
                        message: `Confirm swap: ${amount} ${fromToken} → ${toToken}?`,
                        type: AppSettings.getState().openWithAuth
                            ? "fingerprint"
                            : undefined,
                    });
                    if (!userApproved) {
                        if (messageId !== null) {
                            completeConversation(messageId, "failed");
                        }
                        return "You cancelled the swap.";
                    }

                    const signed = await signVersionedTxFromBase64(
                        orderData.transaction
                    );
                    if (!signed.status) {
                        if (messageId !== null) {
                            completeConversation(messageId, "failed");
                        }
                        return signed.message;
                    }

                    const execRes = await postSwapV2Execute({
                        signedTransaction: signed.signedBase64,
                        requestId,
                        lastValidBlockHeight:
                            typeof orderData.lastValidBlockHeight === "string"
                                ? orderData.lastValidBlockHeight
                                : undefined,
                    });
                    if (!execRes.status || !execRes.data?.signature) {
                        if (messageId !== null) {
                            completeConversation(messageId, "failed");
                        }
                        return execRes.message;
                    }

                    const sig = execRes.data.signature;
                    const network = AppSettings.getState().networkShort;
                    if (messageId !== null) {
                        completeConversation(
                            messageId,
                            "complete",
                            `https://explorer.solana.com/tx/${sig}?cluster=${network}`
                        );
                    }
                    const outRaw = orderData.outAmount
                        ? Number(orderData.outAmount)
                        : 0;
                    const outHuman =
                        outRaw > 0 ? outRaw / Math.pow(10, toDecimals) : 0;
                    const outLabel =
                        outHuman > 0
                            ? String(
                                  outHuman >= 1
                                      ? outHuman
                                            .toFixed(6)
                                            .replace(/\.?0+$/, "")
                                      : outHuman.toPrecision(4)
                              )
                            : orderData.outAmount ?? "the quoted";
                    return await convertSpeech(
                        `You have swapped ${amount} ${fromToken} for about ${outLabel} ${toToken} successfully`
                    );
                }

                const txid = await signTransactions({
                    tx: orderData.transaction,
                    type: "versioned",
                    confirmMessage: `Confirm swap: ${amount} ${fromToken} → ${toToken}?`,
                });
                if (!txid.status) {
                    if (messageId !== null) completeConversation(messageId, "failed");
                    return txid.message;
                }
                const confirmation = await this.session.connection.confirmTransaction(txid.message, "confirmed");

                if (confirmation) {
                    const network = AppSettings.getState().networkShort
                    if (messageId !== null) {
                        completeConversation(messageId, "complete", `https://explorer.solana.com/tx/${txid.message}?cluster=${network}`)
                    }
                    const outRaw = orderData.outAmount
                        ? Number(orderData.outAmount)
                        : 0;
                    const outHuman =
                        outRaw > 0 ? outRaw / Math.pow(10, toDecimals) : 0;
                    const outLabel =
                        outHuman > 0
                            ? String(
                                  outHuman >= 1
                                      ? outHuman.toFixed(6).replace(/\.?0+$/, "")
                                      : outHuman.toPrecision(4)
                              )
                            : orderData.outAmount ?? "the quoted";
                    return await convertSpeech(
                        `You have swapped ${amount} ${fromToken} for about ${outLabel} ${toToken} successfully`
                    );
                } else {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return await convertSpeech(`Sorry, I couldn't perform the swap as ${toToken} is not supported yet . Please try again.`);
                }

            }
        }
    }
    check_price() {
        return {
            name: "check_price",
            owner: "HeySolana",
            description:
                "Check expected swap output. Tokens are resolved by symbol or mint via Jupiter token search (v2). If several tokens match, a picker appears on this card—do not ask for a mint in chat only.",
            parameters: {
                type: "object",
                properties: {
                    fromToken: {
                        type: "string",
                        description: "Token to swap from: symbol or mint address",
                    },
                    toToken: {
                        type: "string",
                        description: "Token to swap to: symbol or mint address",
                    },
                    amount: {
                        type: "number",
                        description: "Human amount of fromToken (ExactIn quote via Jupiter Swap API v2).",
                    },
                },
                required: ["fromToken", "toToken", "amount"],
            },
            handler: async (args: { fromToken: string, toToken: string, amount: number }) => {
                const messageId = this.session.functionMessageId

                const { fromToken, toToken, amount } = args;

                const fail = async (msg: string) => {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return msg;
                };

                const fromRes = await resolveTokenForSwapDisambiguation(fromToken);
                const toRes = await resolveTokenForSwapDisambiguation(toToken);

                if (fromRes.kind === "none" || toRes.kind === "none") {
                    return fail("Could not resolve one or both tokens for a quote. Try mint addresses or configure EXPO_PUBLIC_JUP_API_KEY.");
                }

                let picker: { leg: "from" | "to"; query: string; hits: TokenSearchHit[] } | null = null;
                if (fromRes.kind === "many") {
                    picker = { leg: "from", query: fromRes.query, hits: fromRes.hits };
                } else if (toRes.kind === "many") {
                    picker = { leg: "to", query: toRes.query, hits: toRes.hits };
                }

                if (picker !== null) {
                    if (messageId === null) {
                        return "Several tokens matched; I need the in-chat tool card to show the picker. Try again from chat, or paste a mint address for the token you want.";
                    }
                    const existing = Convo.getState().messages.find((m) => m.id === messageId);
                    Convo.getState().updateMessage({
                        messageId,
                        source: existing?.source ?? "voice",
                        content: {
                            messageType: "token_search",
                            tokenSearchPicker: {
                                query: picker.query,
                                hits: tokenSearchHitsToPickerRows(picker.hits),
                                swapLeg: picker.leg,
                            },
                        },
                    });
                    completeConversation(messageId, "complete");
                    const legPhrase =
                        picker.leg === "from"
                            ? "from token"
                            : "to token";
                    const bothNote =
                        fromRes.kind === "many" && toRes.kind === "many"
                            ? " After you pick this side, ask for the quote again to choose the other token."
                            : "";
                    return await convertSpeech(
                        `Several tokens matched for the ${legPhrase}. Tap one in the list under this card.${bothNote}`
                    );
                }

                if (fromRes.kind !== "one" || toRes.kind !== "one") {
                    return fail("Could not resolve one or both tokens for a quote. Try mint addresses or configure EXPO_PUBLIC_JUP_API_KEY.");
                }

                const fromMintToken = fromRes.meta;
                const toMintToken = toRes.meta;

                const amtSmallest = Math.round(
                    amount * Math.pow(10, fromMintToken.decimals || 0)
                );
                if (!Number.isFinite(amtSmallest) || amtSmallest <= 0) {
                    return fail("Invalid amount for price check.");
                }
                const priceData = await getSwapV2Order({
                    inputMint: fromMintToken.address,
                    outputMint: toMintToken.address,
                    amountSmallestInput: String(amtSmallest),
                    slippageBps: 50,
                });

                if (!priceData?.status) {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return priceData?.message || 'Failed to get price';
                }

                const outAmountRaw = priceData.data?.outAmount;
                const expectedOutAmount = outAmountRaw
                    ? Number(outAmountRaw) / Math.pow(10, toMintToken.decimals || 0)
                    : 0;

                if (messageId !== null) {
                    completeConversation(messageId, 'complete')
                }

                return convertSpeech(`The expected amount of ${amount} ${fromToken} is ${expectedOutAmount} ${toToken}`);
            }

        }
    }

}
