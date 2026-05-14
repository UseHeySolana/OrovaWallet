import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import {
    convertSpeech,
    signTransactions,
} from "@/utils/functions/extrafunctions";
import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import Convo from "@/utils/store/conversation.store";
import {
    completeConversation,
    resolveTokenForSwapDisambiguation,
    tokenSearchHitsToPickerRows,
} from "@/utils/functions";
import type { TokenSearchHit } from "@/libs/jupiter/tokensV2Search";

/**
 * 
 * @param inputMint 
 * @param outputMint 
 * @param amount 
 * @returns {
 * status: boolean,
 * data?: any,
 * message: string,
 * }
 */

const getQuote = async (
    inputMint: string,
    outputMint: string,
    amount: number
) => {
    if (inputMint === "" || outputMint === "" || amount <= 0) {
        return { status: false, message: "Invalid input" };
    }

    try {
        // Get quote for ExactOut swap to USDC
        const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&swapMode=ExactOut&slippageBps=50`;
        const response = await fetch(quoteUrl);
        const quoteData = await response.json();

        if (response.status !== 200) {
            return {
                status: false,
                message: quoteData.error || "Failed to get quote",
            };
        }

        return { status: true, data: quoteData };
    } catch (error) {
        console.error("Error getting quote:", error);
        return { status: false, message: "Failed to get quote" };
    }
};

/**
 *
 * @param quoteResponse
 * @param userPublicKey
 * @returns {
 * status: boolean,
 * data?: any,
 * message: string,
 * }
 */
const performSwap = async (quoteResponse: any, userPublicKey: string) => {
    const swapResponse = await (
        await fetch("https://lite-api.jup.ag/swap", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                quoteResponse,
                userPublicKey,
            }),
        })
    ).json();

    if (!swapResponse) {
        return { status: false, message: "Failed to perform swap" };
    }

    return { status: true, data: swapResponse };
};

/**
 * 
 * @param fromMint 
 * @param toMint 
 * @returns {
 * status: boolean,
 * data?: any,
 * message: string,
 * }
 */


const getPrice = async (fromMint: string, toMint: string, amount: number) => {
    try {
        const options = { method: 'GET', headers: { 'x-api-key': process.env.EXPO_PUBLIC_JUP_API_KEY || '' } };
        const res = await fetch(
            `https://api.jup.ag/swap/v1/quote?swapMode=ExactIn&maxAccounts=64&instructionVersion=V1&inputMint=${fromMint}&outputMint=${toMint}&amount=${amount}`,
            options
        );
        const priceData = await res.json();
        if (res.status !== 200 || priceData.error) {
            return { status: false, message: priceData.error || priceData.message || 'Failed to get price' };
        }
        return { status: true, data: priceData };
    } catch (error) {
        console.error('Error getting price:', error);
        return { status: false, message: (error as Error).message || 'Failed to get price' };
    }
}



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
                        description: "The amount to swap (human units): amount of toToken you want to receive (exact-out quote).",
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

                const quoteResponse = await getQuote(fromMint?.address || '', toMint?.address || '', amount * Math.pow(10, toMint.decimals));
                if (!quoteResponse.status) {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return quoteResponse.message;
                }

                const swapResponse = await performSwap(quoteResponse.data, userPublicKey?.toString() || '');
                if (!swapResponse.status) {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return swapResponse.message;
                }

                const txid = await signTransactions({
                    tx: swapResponse.data.swapTransaction,
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
                    return await convertSpeech(`You have swapped ${amount} ${fromToken} for ${swapResponse.data.outputAmount} ${toToken} successfully`);
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
                        description: "The amount of the token I want to swap"
                    }
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

                console.log("PRICE DATA", fromMintToken.address, toMintToken.address, amount * Math.pow(10, fromMintToken.decimals || 0));

                const priceData = await getPrice(
                    fromMintToken.address,
                    toMintToken.address,
                    amount * Math.pow(10, fromMintToken.decimals || 0)
                );

                if (!priceData?.status) {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return priceData?.message || 'Failed to get price';
                }

                // Jupiter quote returns { inAmount, outAmount, ... } - outAmount is expected output in smallest units
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
