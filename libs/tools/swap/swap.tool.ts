import { Connection } from "@solana/web3.js";
import { userWalletType } from "@/utils/store/userstore.store";
import { fetchData } from "@/utils/request/db";
import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import {
    convertSpeech,
    signTransactions,
} from "@/utils/functions/extrafunctions";
import Convo from "@/utils/store/conversation.store";
import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import {
    completeConversation,
    supportedTokens,
    verifiedTokens,
} from "@/utils/functions";

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
            description: "This function is used to swap between two tokens",
            parameters: {
                type: "object",
                properties: {
                    amount: {
                        type: "number",
                        description: "The amount to swap, this is the amount of the token the user is swapping to, the toToken amount'"
                    },
                    fromToken: {
                        type: "string",
                        description: "the token that being swapped'"
                    },
                    toToken: {
                        type: "string",
                        description: "the token user wants to receive'"
                    },
                },
                required: ["amount", "fromToken", "toToken"],
            },
            handler: async (args: { amount: number, fromToken: string, toToken: string }) => {

                const { amount, fromToken, toToken } = args;
                const messageId = this.session.functionMessageId


                const fromMint = verifiedTokens.find(token => token.symbol === fromToken);
                const toMint = verifiedTokens.find(token => token.symbol === toToken);

                if (!fromMint || !toMint) {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return "Token swap not supported yet!";
                }

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

                const txid = await signTransactions({ tx: swapResponse.data.swapTransaction, type: "versioned" });
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
            description: "This function is used to check the price of a token",
            parameters: {
                type: "object",
                properties: {
                    fromToken: {
                        type: "string",
                        description: "The token I want to swap from"
                    },
                    toToken: {
                        type: "string",
                        description: "The token I want to swap to"
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

                const fromMintToken = verifiedTokens.find(token => token.symbol === fromToken);
                const toMintToken = verifiedTokens.find(token => token.symbol === toToken);

                if (!fromMintToken || !toMintToken) {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return "Token  swap not supported yet!";
                }

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
