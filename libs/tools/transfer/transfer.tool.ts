import { Connection, PublicKey } from "@solana/web3.js";
import { transferSol, transferToken, getTokenBalance } from "@/libs/tools/transfer/transfers";
import type { VoiceAssistantSession } from "@/libs/voiceinfra/types";
import { FunctionParams } from "@/utils/types/types";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import AppSettings from "@/utils/store/settingsstore.store";
import { completeConversation, getUserDetails, resolveTokenByQuery } from "@/utils/functions";
import WalletItem from "@/utils/store/wallet.store";
import { getBalance } from "@/utils/wallet";
import { recordTransferTransaction } from "@/services/appTransactions";

const getWalletAddressFromInput = (input: string): string | null => {
    const candidate = input.trim();
    try {
        const publicKey = new PublicKey(candidate);
        return publicKey.toBase58() === candidate ? candidate : null;
    } catch {
        return null;
    }
};

const shortenWalletAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

const resolveTransferRecipient = async (
    recipient: string,
    allowWalletAddress: boolean
) => {
    const directWalletAddress = allowWalletAddress
        ? getWalletAddressFromInput(recipient)
        : null;

    if (directWalletAddress) {
        return {
            walletAddress: directWalletAddress,
            displayName: shortenWalletAddress(directWalletAddress),
        };
    }

    const userCheck = await getUserDetails(recipient);
    if (!userCheck) return null;

    return {
        walletAddress: userCheck.wallet_address,
        displayName: recipient,
    };
};

const aiTransfer = async (connection: Connection, args: { amount: number, token: string, recipient: string }, options?: { allowWalletAddressRecipient?: boolean }) => {
    const { amount, token, recipient } = args;
    const recipientDetails = await resolveTransferRecipient(
        recipient,
        options?.allowWalletAddressRecipient === true
    );
    if (!recipientDetails) {
        const response = await convertSpeech(
            options?.allowWalletAddressRecipient
                ? "Sorry, I could not find that Hey Solana username or read that as a valid Solana wallet address."
                : "Sorry there is no user on the Hey Solana App with that username"
        )
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

        const transfer = await transferSol(recipientDetails.walletAddress, amount, connection)

        if(!transfer.status){
            return{
                status: false,
                txId: '',
                comment: transfer.message,
            }
        }
        

        const confirmation = await connection.confirmTransaction(transfer.message, "confirmed");

        if (confirmation) {
            const transferRes = await convertSpeech(`You have transferred ${amount} SOL to ${recipientDetails.displayName} Successfully`)
            recordTransferTransaction({
                signature: transfer.message,
                symbol: "SOL",
                amount,
                recipient: recipientDetails.walletAddress,
                app_called: "HeySolana",
            });
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
        const meta = await resolveTokenByQuery(token);
        if (!meta || meta.symbol === "SOL") {
            const response = await convertSpeech(
                `Could not resolve "${token}" to an SPL token, or SOL was requested as SPL. Use SOL for native transfers or a valid token symbol/mint.`
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
            recipientDetails.walletAddress,
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
            const transferRes = await convertSpeech(`You have transferred ${amount} ${meta.name} to ${recipientDetails.displayName} Successfully`);
            recordTransferTransaction({
                signature: transfer.message,
                mint: meta.address,
                symbol: meta.symbol ?? meta.name,
                amount,
                recipient: recipientDetails.walletAddress,
                app_called: "HeySolana",
            });
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

    constructor(public session: VoiceAssistantSession) {
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
                        description: "The username of the recipient. In typed chat mode only, this may also be a pasted Solana wallet address."
                    }
                },
                required: ["amount", "recipient", "token"],
            },
            handler: async (args: { amount: number, token: string, recipient: string }) => {
                const messageId = this.session.functionMessageId
                let response = await aiTransfer(this.session.connection, args, {
                    allowWalletAddressRecipient: this.session.isChatInputSession(),
                })
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
