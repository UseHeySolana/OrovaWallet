import AppSettings from "@/misc/store/settingsstore";
import SessionManager from "../aistream/aistream";
import GeminiSessionManager from "../gemini/StreamManager";
import { FunctionParams } from "../types";
import UserItem from "@/misc/store/userstore";
import { fetchData, purchaseAirtime } from "../db";
import WalletItem from "@/misc/store/wallet";
import { Transaction } from "@solana/web3.js";
import { convertSpeech, signTransactions } from "../miscfunctions.ts/extrafunctions";

export class AirBills {
    public buyAirtime: FunctionParams;

    constructor(public session: SessionManager | GeminiSessionManager) {
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
                AppSettings.getState().setLoading(true)

                const userDetails = this.session.userDetails;
                // Check if the user has that token
                const exist = userDetails.tokenAccounts.find((item: any) => item?.symbol?.toLowerCase() === "usdc");

                if (!exist) {
                    AppSettings.getState().setLoading(false)
                    return "You do not have any USDC in your wallet, please swap some token and try again";
                }

                const user = UserItem.getState().user
                let mobileNumber: string;

                if (args.username === user?.username) {
                    mobileNumber = user.mobileNumber;
                } else {

                    const users = await fetchData()
                    const filtered = users.filter(
                        (msg: any) =>
                            msg.username.toLowerCase().includes(args.username.toLowerCase())
                    );
                    if (filtered.length < 1) {
                        const response = await convertSpeech("Sorry there is no user on the Hey Solana App with that username")
                        return response
                    }
                    mobileNumber = filtered[0].mobileNumber;
                }

                const userWalletAddress = WalletItem.getState().publicKey?.toString() || "";
                const keyPair = WalletItem.getState().keypair || null;
                if (!keyPair) {
                    AppSettings.getState().setLoading(false)
                    return "Please connect your wallet to proceed";
                }

                console.log("userWalletAddress", userWalletAddress);

                const response = await purchaseAirtime(mobileNumber, args.amount, userWalletAddress);

                if (!response.status) {
                    AppSettings.getState().setLoading(false)
                    return response.message;
                }

                const result = response.data;

                const res = await signTransactions(result.ix)

                setTimeout(() => {
                    this.session.stopSession()
                    AppSettings.getState().setLoading(false)
                }, 1000)

                return res;
            }
        }
    }
}
