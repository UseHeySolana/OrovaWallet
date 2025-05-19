import AppSettings from "@/misc/store/settingsstore";
import SessionManager from "../aistream/aistream";
import GeminiSessionManager from "../gemini/StreamManager";
import { FunctionParams } from "../types";
import UserItem from "@/misc/store/userstore";
import { fetchData, purchaseAirtime, completePurchase } from "../db";
import WalletItem from "@/misc/store/wallet";
import { Transaction } from "@solana/web3.js";
import { cleanNumber, convertSpeech, signTransactions } from "../miscfunctions.ts/extrafunctions";
import Convo from "@/misc/store/conversation";

export class AirBills {
    public buyAirtime: FunctionParams;

    constructor(public session: SessionManager) {
        this.buyAirtime = this.buy_airtime()
    }
    buy_airtime() {
        return {
            name: "buy-airtime",
            description: "This function is used to purchase airtime credits for a particular user either myself or on behalf of another user",
            parameters: {
                type: "object",
                properties: {
                    username: {
                        type: "string",
                        description: "This is the username of the person you are sending the airtime to, it should be a string"
                    },
                    amount: {
                        type: "number",
                        description: "This is the amount of airtime you want to purchase, it should be a number"
                    },

                },
                required: ["username", "amount"],
            },

            handler: async (args: { username: string, amount: number, }) => {


                const userDetails = this.session.userDetails;
                // Check if the user has that token
                const exist = userDetails.tokenAccounts.find((item: any) => item?.symbol?.toLowerCase() === "usdc");

                if (!exist) {

                    return "You do not have any USDC in your wallet, please swap some token and try again";
                }

                const user = UserItem.getState().user
                let mobileNumber: string;

                if (args.username.toLowerCase() === user?.username.toLowerCase()) {
                    mobileNumber = user.mobileNumber;
                } else {

                    const users = await fetchData()
                    const filtered = users.filter(
                        (msg: any) =>
                            msg.username.toLowerCase() === args.username.toLowerCase()
                    );
                    if (filtered.length < 1) {
                        const response = await convertSpeech("Sorry there is no user on the Hey Solana App with that username")
                        return response
                    }
                    mobileNumber = cleanNumber(filtered[0].phone_number);
                }



                const userWalletAddress = WalletItem.getState().publicKey?.toString() || "";
                const keyPair = WalletItem.getState().keypair || null;
                if (!keyPair) {

                    return "Please connect your wallet to proceed";
                }

                const response = await purchaseAirtime(mobileNumber, args.amount, userWalletAddress);

                const result = response.data;
                const dataId = result.id;

                const res = await signTransactions(result.ix)
                const confirmation = await this.session.connection.confirmTransaction(res, "confirmed");

                if (confirmation) {
                    const completePurchaseRes = await completePurchase(dataId)

                    if (completePurchaseRes.status) {
                        const messageId = this.session.functionMessageId
                        const network = AppSettings.getState().networkShort
                        if (messageId !== null) {
                            Convo.getState().updateMessage(messageId, {
                                status: 'complete',
                                link: `https://explorer.solana.com/tx/${res}?cluster=${network}`
                            })
                        }
                        return await convertSpeech('Your airtime purchase is successfull');
                    } else {
                        return await convertSpeech('Airtime purchase failed!');
                    }
                } else {
                    const messageId = this.session.functionMessageId
                    if (messageId !== null) {
                        Convo.getState().updateMessage(messageId, {
                            status: 'failed',
                        })
                    }

                    return await convertSpeech('Airtime purchase failed!');
                }



            }
        }
    }
}
