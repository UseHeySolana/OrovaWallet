import { Connection } from "@solana/web3.js";
import { userWalletType } from "@/misc/store/userstore";
import { fetchData } from "../db";
import { transferSol, transferToken } from "../transfers";
import SessionManager from "../aistream/aistream";
import { FunctionParams } from "../types";
import { convertSpeech, signTransactions } from "../miscfunctions.ts/extrafunctions";
import Convo from "@/misc/store/conversation";
import AppSettings from "@/misc/store/settingsstore";
import WalletItem from "@/misc/store/wallet";

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

const getQuote = async (inputMint: string, outputMint: string, amount: string) => {
    try {
        // Get quote for ExactOut swap to USDC
        const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&swapMode=ExactOut&slippageBps=50`;
        const response = await fetch(quoteUrl);
        const quoteData = await response.json();

        if (response.status !== 200) {
            return ({ status: false, message: quoteData.error || 'Failed to get quote' });
        }

        return ({ status: true, data: quoteData });
    } catch (error) {
        console.error('Error getting quote:', error);
        return ({ status: false, message: 'Failed to get quote' });
    }
}

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
        await fetch('https://api.jup.ag/swap/v1/swap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                quoteResponse,
                userPublicKey,
            })
        })
    ).json();

    if (swapResponse.status !== 200) {
        return ({ status: false, message: swapResponse.error || 'Failed to perform swap' });
    }

    return ({ status: true, data: swapResponse });
}
export class SwapFunction {
    public swapFunction: FunctionParams;

    constructor(public session: SessionManager) {
        this.swapFunction = this.swap_tokens()
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
                        description: "The amount to swap'"
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

                const userPublicKey = WalletItem.getState().publicKey;


                const quoteResponse = await getQuote(fromToken, toToken, amount.toString());
                if (!quoteResponse.status) {
                    return quoteResponse.message;
                }

                const swapResponse = await performSwap(quoteResponse.data, userPublicKey?.toString() || '');
                if (!swapResponse.status) {
                    return swapResponse.message;
                }

                const txid = await signTransactions(swapResponse.data.swapTransaction);
                console.log(`Transaction submitted with signature: ${txid}`);
                const confirmation = await this.session.connection.confirmTransaction(txid, "confirmed");

                if (confirmation) {
                    const messageId = this.session.functionMessageId
                    const network = AppSettings.getState().networkShort
                    if (messageId !== null) {
                        Convo.getState().updateMessage(messageId, {
                            status: 'complete',
                            link: `https://explorer.solana.com/tx/${txid}?cluster=${network}`
                        })
                    }
                    return await convertSpeech(`You have swapped ${amount} ${fromToken} for ${swapResponse.data.outputAmount} ${toToken} successfully`);
                } else {
                    const messageId = this.session.functionMessageId
                    if (messageId !== null) {
                        Convo.getState().updateMessage(messageId, {
                            status: 'failed',
                        })
                    }
                    return await convertSpeech(`Sorry, I couldn't perform the swap as ${toToken} is not supported yet . Please try again.`);
                }

            }
        }
    }


}
