import { Connection } from "@solana/web3.js";
import { userWalletType } from "@/misc/store/userstore";
import { convertSpeech } from "../ai-lang";
import { fetchData } from "../db";
import { transferSol, transferToken } from "../transfers";
import SessionManager from "../aistream/aistream";
import GeminiSessionManager from "../gemini/StreamManager";
import { FunctionParams } from "../types";

const aiTransfer = async (userDetails: userWalletType, connection: Connection, args:{amount: number, token: string, recipient: string}) => {
    const { amount, token, recipient } = args;
    //check if the user exist on app
    const users = await fetchData()
    const filtered = users.filter(
        (msg: any) =>
            msg.username.toLowerCase().includes(recipient.toLowerCase())
    );
    if (filtered.length < 1) {
        const response = await convertSpeech("Sorry there is no user on the Hey Solana App with that username")
        return response
    }

    console.log(filtered)
    if (token.toLowerCase() == "sol") {
        let balance = userDetails?.solBalance
        //check if the balance is sufficient
        if (Number(balance?.toFixed(2)) < Number(amount)) {
            const response = await convertSpeech("You do not have sufficient SOL to perform this transaction!")
            return response;
        }

        const transfer = await transferSol(filtered[0].wallet_address, amount, connection)

        const transferRes = await convertSpeech(`You have transferred ${amount} SOL to ${recipient} Successfully`)
        return transferRes;
    } else {
        const tokens :any = userDetails.tokenAccounts.filter((item: any) => item?.symbol?.toLowerCase() === token.toLowerCase());
        if (tokens.length < 1) {
            const response = await convertSpeech(`You do not have ${token} in your account!`)
            return response;
        } else {
            const balance = tokens[0].balance;
            if (Number(balance?.toFixed(2)) < Number(amount)) {
                const response = await convertSpeech(`You do not have sufficient ${tokens[0].name} to perform this transaction!`)
                return response;
            }
            const transfer = await transferToken(filtered[0].wallet_address, tokens[0].mint, amount, tokens[0].decimals, connection)

            if (transfer) {
                const transferRes = await convertSpeech(`You have transferred ${amount} ${tokens[0].name} to ${recipient} Successfully`)
                return transferRes;
            } else {
                const transferRes = await convertSpeech(`Sorry, I couldn't perform the transfer as ${token} is not supported yet . Please try again.`)
                return transferRes;
            }
        }
    }
}
export class TransferFunction  {
    public transferFunction: FunctionParams;

    constructor(public session: SessionManager | GeminiSessionManager) {
        this.transferFunction = this.transfer_tokens()
    }
    transfer_tokens() {
        return {
            name: "transfer_tokens",
            description: "This function is used to transfer tokens from one user to another",
            parameters: {
                type: "object",
                properties: {
                    amount: {
                        type: "number",
                        description: "The amount to transfer'"
                    },
                    token: {
                        type: "string",
                        description: "the token that is being transferred'"
                    },
                    recipient: {
                        type: "string",
                        description: "The user name of the recipient"
                    }
                },
                required: ["amount", "recipient", "token"],
            },
            handler: async (args: { amount: number, token: string, recipient:string})=>{
                let response = await aiTransfer(this.session.userDetails, this.session.connection, args)

                return response;
            }
        }
    }


}
