import { GoogleGenerativeAI } from "@google/generative-ai";
import AppSettings from "../../store/settingsstore";
import { cache } from "../storage/cache";
import { getTransactionHistory } from "../db";
import WalletItem from "@/misc/store/wallet";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { api_key } from "@/app/requests/dashboard";
import { Linking } from "react-native";

const cleanNumber = (input: any) => {
    // Remove non-digit characters
    let cleaned = input.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }
    return cleaned

}

const showToast = (message: string) => {

    AppSettings.getState().setToast(message, 'info')
}


const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GA_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const convertSpeech = async (sentence: any) => {
    const result = await model.generateContent([
        `"${sentence} "Can you rewrite this sentence in a more conversational tone, I want to use it for a text to speech api, make it friendly
        
        Don't return any extra text just the re construct the sentence in a more conversational tone.
        `,
    ]);
    return result.response.text();
};


const getTokenTransactions = async (mintAddress: string) => {
    const response = {
        status: false,
        data: null
    }

    const txHistory = await cache.get('txHistory');
    if (!txHistory) {
        const publicKey = WalletItem.getState().publicKey;
        if (!publicKey) {
            response.status = false
            return response;
        }
        const fetchedTxHistory = await getTransactionHistory(publicKey?.toString());
        if (!fetchedTxHistory.status) {
            return response;
        }

        cache.set('txHistory', JSON.stringify(fetchedTxHistory));

        const filtered = fetchedTxHistory.data.filter((tx: any) => {
            const mintInTokenTransfers = tx.tokenTransfers?.some((t: any) => t.mint === mintAddress);
            const mintInAccountData = tx.accountData?.some((account: any) =>
                account.tokenBalanceChanges?.some((t: any) => t.mint === mintAddress)
            );
            const mintInSwapInputs = tx.events?.swap?.tokenInputs?.some((t: any) => t.mint === mintAddress);
            const mintInSwapOutputs = tx.events?.swap?.tokenOutputs?.some((t: any) => t.mint === mintAddress);
            const mintInInnerSwaps = tx.events?.swap?.innerSwaps?.some((swap: any) =>
                swap.tokenInputs?.some((t: any) => t.mint === mintAddress) ||
                swap.tokenOutputs?.some((t: any) => t.mint === mintAddress) ||
                swap.tokenFees?.some((t: any) => t.mint === mintAddress)
            );
            const mintInNfts = tx.events?.nft?.nfts?.some((nft: any) => nft.mint === mintAddress);

            return mintInTokenTransfers || mintInAccountData || mintInSwapInputs ||
                mintInSwapOutputs || mintInInnerSwaps || mintInNfts;
        });

        response.status = true
        response.data = filtered
        return response;
    }


    const parsedTx = JSON.parse(txHistory)
    const filtered = parsedTx.data.filter((tx: any) => {
        const mintInTokenTransfers = tx.tokenTransfers?.some((t: any) => t.mint === mintAddress);
        const mintInAccountData = tx.accountData?.some((account: any) =>
            account.tokenBalanceChanges?.some((t: any) => t.mint === mintAddress)
        );
        const mintInSwapInputs = tx.events?.swap?.tokenInputs?.some((t: any) => t.mint === mintAddress);
        const mintInSwapOutputs = tx.events?.swap?.tokenOutputs?.some((t: any) => t.mint === mintAddress);
        const mintInInnerSwaps = tx.events?.swap?.innerSwaps?.some((swap: any) =>
            swap.tokenInputs?.some((t: any) => t.mint === mintAddress) ||
            swap.tokenOutputs?.some((t: any) => t.mint === mintAddress) ||
            swap.tokenFees?.some((t: any) => t.mint === mintAddress)
        );
        const mintInNfts = tx.events?.nft?.nfts?.some((nft: any) => nft.mint === mintAddress);

        return mintInTokenTransfers || mintInAccountData || mintInSwapInputs ||
            mintInSwapOutputs || mintInInnerSwaps || mintInNfts;
    });;
    response.status = true
    response.data = filtered
    return response;
}


type DateInput = number | string | Date;

interface FormatOptions {
    locale?: string;
    dateStyle?: 'full' | 'long' | 'medium' | 'short';
    timeStyle?: 'full' | 'long' | 'medium' | 'short';
}
function formatDate(input: DateInput, options: FormatOptions = {}): string {
    const {
        locale = 'en-US',
        dateStyle = 'medium',
        timeStyle = 'short'
    } = options;

    let date: Date;

    if (typeof input === 'number') {
        // Detect seconds vs milliseconds
        date = input < 1e12 ? new Date(input * 1000) : new Date(input);
    } else if (typeof input === 'string') {
        date = new Date(input);
    } else if (input instanceof Date) {
        date = input;
    } else {
        throw new Error('Unsupported date format');
    }

    if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
    }

    return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle }).format(date);
}

const shortenPub = (pub: string) => {
    return pub.slice(0, 4) + "..." + pub.slice(-4)
}


const keypairSign = async () => {
    const keypair = WalletItem.getState().keypair;
    if (!keypair) {
        return null;
    }
    const secretKeyArray = Object.values(keypair["_keypair"].secretKey)
    const keypairNew = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

    return keypairNew;
}


const signTransactions = async (tx: string) => {
    const network = AppSettings.getState().network;
    const connection = new Connection(`${network}${api_key}`)

    const keyPair = await keypairSign();
    if (!keyPair || !connection) {
        return 'Keypair not initialized or connection failed!'

    }

    const txBuffer = Buffer.from(tx, "base64");

    let transaction = Transaction.from(txBuffer);
    // Correct way to sign
    transaction.partialSign(keyPair);

    try {
        const txid = await connection.sendRawTransaction(transaction.serialize());

        return txid;
    } catch (error) {

        return `Signing failed: ${error instanceof Error ? error.message : String(error)}`;
    }
}

const openURL = async (url: string) => {
    const supported = await Linking.canOpenURL(url);

    if (supported) {
        await Linking.openURL(url);
    } else {
        console.warn(`Don't know how to open URI: ${url}`);
    }
};
export {
    showToast,
    cleanNumber,
    convertSpeech,
    getTokenTransactions,
    formatDate,
    shortenPub,
    keypairSign,
    signTransactions,
    openURL,
}