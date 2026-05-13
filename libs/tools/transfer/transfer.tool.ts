import { Connection } from "@solana/web3.js";
import { transferSol, transferToken, getTokenBalance } from "@/libs/tools/transfer/transfers";
import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import AppSettings from "@/utils/store/settingsstore.store";
import { completeConversation, getUserDetails, verifiedTokens } from "@/utils/functions";
import WalletItem from "@/utils/store/wallet.store";
import { getBalance } from "@/utils/wallet";

const aiTransfer = async (connection: Connection, args: { amount: number, token: string, recipient: string }) => {
    const { amount, token, recipient } = args;
    //check if the user exist on app
    const userCheck = await getUserDetails(recipient)
    if (!userCheck) {
        const response = await convertSpeech("Sorry there is no user on the Hey Solana App with that username")
        const data = {
            status: false,
            txId: '',
            comment: response,
        }
        return data;
    }

    const sender = WalletItem.getState().publicKey;
    if (!sender) {
        const response = await convertSpeech("Please connect your wallet to transfer.");
        return { status: false, txId: "", comment: response };
    }

    if (token.toLowerCase() === "sol") {
        const balance = await getBalance(sender, connection);
        if (balance < amount) {
            const response = await convertSpeech("You do not have sufficient SOL to perform this transaction!")
            const data = {
                status: false,
                txId: '',
                comment: response,
            }
            return data;
        }

        const transfer = await transferSol(userCheck.wallet_address, amount, connection)

        if(!transfer.status){
            return{
                status: false,
                txId: '',
                comment: transfer.message,
            }
        }
        

        const confirmation = await connection.confirmTransaction(transfer.message, "confirmed");

        if (confirmation) {
            const transferRes = await convertSpeech(`You have transferred ${amount} SOL to ${recipient} Successfully`)
            const data = {
                status: true,
                txId: transfer.message,
                comment: transferRes,
            }
            return data;
        } else {
            const transferRes = await convertSpeech(`Sorry, I couldn't perform the transfer as ${token} is not supported yet . Please try again.`)
            const data = {
                status: false,
                txId: '',
                comment: transferRes,
            }
            return data;
        }
    } else {
        const meta = verifiedTokens.find(
            (t) => t.symbol.toLowerCase() === token.toLowerCase()
        );
        if (!meta || meta.symbol === "SOL") {
            const response = await convertSpeech(
                `You do not have ${token} in your account or this token is not supported for transfer here.`
            );
            return { status: false, txId: "", comment: response };
        }

        const balance = await getTokenBalance(
            sender.toBase58(),
            meta.address,
            meta.decimals,
            connection
        );
        if (balance < amount) {
            const response = await convertSpeech(
                `You do not have sufficient ${meta.name} to perform this transaction!`
            );
            return { status: false, txId: "", comment: response };
        }

        const transfer = await transferToken(
            userCheck.wallet_address,
            meta.address,
            amount,
            meta.decimals,
            connection
        );

        if (!transfer.status) {
            return {
                status: false,
                txId: "",
                comment: transfer.message,
            };
        }
        const confirmation = await connection.confirmTransaction(transfer.message, "confirmed");

        if (confirmation) {
            const transferRes = await convertSpeech(`You have transferred ${amount} ${meta.name} to ${recipient} Successfully`);
            const data = {
                status: true,
                txId: transfer.message,
                comment: transferRes,
            };
            return data;
        } else {
            const transferRes = await convertSpeech(
                `Sorry, I couldn't perform the transfer as ${token} is not supported yet . Please try again.`
            );
            const data = {
                status: false,
                txId: "",
                comment: transferRes,
            };
            return data;
        }
    }
}
export class TransferFunction {
    public transferFunction: FunctionParams;

    constructor(public session: SessionManager) {
        this.transferFunction = this.transfer_tokens()
    }
    transfer_tokens() {
        return {
            name: "transfer_tokens",
            owner: "HeySolana",
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
            handler: async (args: { amount: number, token: string, recipient: string }) => {
                const messageId = this.session.functionMessageId
                let response = await aiTransfer(this.session.connection, args)
                if (response.status) {
                    const network = AppSettings.getState().networkShort
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `https://explorer.solana.com/tx/${response.txId}?cluster=${network}`)
                    }
                } else {
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed')
                    }
                }

                return response.comment;
            }
        }
    }


}
