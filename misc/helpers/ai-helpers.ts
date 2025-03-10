import { UserDetails } from "@/context/UserSettingsProvider";
import { Connection, Keypair } from "@solana/web3.js";
import { convertSpeech, delay } from "./ai";
import { fetchData } from "./db";
import { playText } from "./deepgram";
import { transferSol, transferToken } from "./transfers";
import { AudioManager } from "../classes/audioManagerClass";

export const aiCheckBalance = async (keyPair: Keypair, userDetails: UserDetails, object: any) => {
    if (object.details.token == "SOL") {
        const balance = userDetails?.solBalance;
        let response = await convertSpeech(`Your current balance is ${balance?.toFixed(2)} SOL. Do you want to perform another action?`)
        return response;
    } else {
        const tokens = userDetails.tokenAccounts.filter((item: any) => item.symbol === object.details.token);
        if (tokens.length < 1) {
            let response = await convertSpeech(`you do not have, ${object.details.token} token in your account?. If you do please spell the token out let me try again.`)
            return response;
        } else {
            let response = await convertSpeech(`Your current ${tokens[0].name} balance is ${tokens[0].balance} ${object.details.token}. Do you want to perform another action?`)
            return response;
        }
    }
}

export const aiTransfer = async (audioClass: AudioManager, object: any) => {
    const userDetails = audioClass.userDetails;
    const connection = audioClass.connection;
    const details = object.details;
    //check if the user exist on app
    const users = await fetchData()
    const filtered = users.filter(
        (msg:any) =>
            msg.username.toLowerCase().includes(details.recipient.toLowerCase())
    );
    if (filtered.length < 1) {
        const response = await convertSpeech("Sorry there is no user on the Hey Solana App with that username")
        return response
    }
    const response = await convertSpeech("User Found Sending token now")
    await playText(audioClass, response, false)
    await delay(500);

    if (details.token.toLowerCase() == "sol") {
        let balance = userDetails?.solBalance
        //check if the balance is sufficient
        if (Number(balance?.toFixed(2)) < Number(details.amount)) {
            const response = await convertSpeech("You do not have sufficient SOL to perform this transaction!")
            return response;
        }

        const transfer = await transferSol(filtered[0].wallet_address, details.amount, connection)

        const transferRes = await convertSpeech(`You have transferred ${details.amount} SOL to ${details.recipient} Successfully`)
        return transferRes;
    } else {
        const tokens = userDetails.tokenAccounts.filter((item: any) => item?.symbol?.toLowerCase() === details.token.toLowerCase());
        if (tokens.length < 1) {
            const response = await convertSpeech(`You do not have ${details.token} in your account!`)
            return response;
        } else {
            const balance = tokens[0].balance;
            if (Number(balance?.toFixed(2)) < Number(details.amount)) {
                const response = await convertSpeech(`You do not have sufficient ${tokens[0].name} to perform this transaction!`)
                return response;
            }
            const transfer = await transferToken(filtered[0].wallet_address, tokens[0].mint, details.amount, tokens[0].decimals, connection)

            if (transfer) {
                const transferRes = await convertSpeech(`You have transferred ${details.amount} ${tokens[0].name} to ${details.recipient} Successfully`)
                return transferRes;
            } else {
                const transferRes = await convertSpeech(`Sorry, I couldn't perform the transfer as ${details.token} is not supported yet . Please try again.`)
                return transferRes;
            }
        }
    }
}