import { Connection } from "@solana/web3.js";
import { userWalletType } from "@/misc/store/userstore";
import { fetchData } from "../db";
import SessionManager from "../aistream/aistream";
import { FunctionParams } from "../types";
import { convertSpeech, signTransactions } from "../miscfunctions.ts/extrafunctions";
import Convo from "@/misc/store/conversation";
import AppSettings from "@/misc/store/settingsstore";
import WalletItem from "@/misc/store/wallet";
import { completeConversation } from "../miscfunctions.ts";

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

const getQuote = async (inputMint: string, outputMint: string, amount: number) => {

    if(inputMint === "" || outputMint === "" || amount <= 0){
        return ({ status: false, message: 'Invalid input' });
    }

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

    if (!swapResponse) {
        return ({ status: false, message: 'Failed to perform swap' });
    }

    return ({ status: true, data: swapResponse });
}

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


const getPrice = async (fromMint: string, toMint: string) => {
    try {
        const priceUrl = `https://lite-api.jup.ag/price/v2?ids=${fromMint}&vsToken=${toMint}`;
        const priceResponse = await fetch(priceUrl);
        const priceData = await priceResponse.json();

        if (priceResponse.status !== 200) {
            return ({ status: false, message: priceData.error || 'Failed to get price' });
        }

        return ({ status: true, data: priceData });
    } catch (error) {
        console.error('Error getting price:', error);
        return ({ status: false, message: 'Failed to get price' });
    }
}

export const verifiedTokens = [
    {
        "name": "Solana",
        "address": "So11111111111111111111111111111111111111112",
        "symbol": "SOL",
        "decimals": 9,
        "logo": "https://assets.coingecko.com/coins/images/4128/large/solana.png?1640133422"
    },
    {
        "name": "USDC",
        "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "symbol": "USDC",
        "decimals": 6,
        "logo": "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194"
    },
    {
        "name": "USDT",
        "address": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "symbol": "USDT",
        "decimals": 6,
        "logo": "https://assets.coingecko.com/coins/images/325/large/Tether.png?1696501580"
    },
    {
        "name": "Bonk",
        "address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        "symbol": "Bonk",
        "decimals": 5,
        "logo": "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I"
    },
    {
        "name": "Metaplex Token",
        "address": "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
        "symbol": "MPLX",
        "decimals": 6,
        "logo": "https://arweave.net/VRKOcXIvCxqp35RZ9I0-bDGk5qNfT46OTho-2oP9iGc"
    }
]

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

                if(!fromMint || !toMint){
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

                const txid = await signTransactions({tx: swapResponse.data.swapTransaction, type: "versioned"});
                console.log(`Transaction submitted with signature: ${txid}`);
                const confirmation = await this.session.connection.confirmTransaction(txid, "confirmed");

                if (confirmation) {
                    const network = AppSettings.getState().networkShort
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `https://explorer.solana.com/tx/${txid}?cluster=${network}`)
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
    check_price(){
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

                const fromMint = verifiedTokens.find(token => token.symbol === fromToken)?.address;
                const toMint = verifiedTokens.find(token => token.symbol === toToken)?.address;

                if(!fromMint || !toMint){   
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return "Token  swap not supported yet!";
                }


                const priceData = await getPrice(fromMint || '', toMint || '');
                if(!priceData.status){
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                    return priceData.message;
                }

                const priceComparedtoOneToMint = priceData.data.data[fromMint].price;
                const priceInSwap = priceComparedtoOneToMint * amount;


                if (messageId !== null) {
                    completeConversation(messageId, 'complete')
                }


                return convertSpeech(`The expected amount of ${amount} ${fromToken} is ${priceInSwap} ${toToken}`);
            }

        }
    }

}
