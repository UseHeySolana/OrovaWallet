
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as bip39 from "bip39";
import { derivePath } from 'ed25519-hd-key';
import { storage } from './storage';
import { isJson } from './ai';



export const generateMnemonic = () => {
    return bip39.generateMnemonic();
};

export const getKeypairFromMnemonic = (mnemonic: string) => {
    if (isJson(mnemonic)) {
        return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(mnemonic)));
    } else {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;

    return Keypair.fromSeed(derivedSeed);
    }
};

export const getKeyPair = async () => {
    let mnemonic = storage.get('mnemonic');

    if (!mnemonic) {
        return false;
    }
    let keypair = getKeypairFromMnemonic(mnemonic)

    return keypair;
}

export const fetchConversionRate = async (fromCurrency: string) => {

    try {
        let data = await fetch(`https://api.jup.ag/price/v2?ids=${fromCurrency}`)
        let jsonData = await data.json();
        return jsonData.data[fromCurrency].price;

    } catch (error) {
        console.error("Error fetching conversion rate:", error);
        return null;
    }

}

const API_KEY = process.env.NEXT_PUBLIC_HELIUS_API;
export const fetchTokenDetails = async (mintAddress: string) => {
    try {

        const data = await fetch(`https://mainnet.helius-rpc.com/?api-key=${API_KEY}`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "jsonrpc": "2.0",
                "id": "test",
                "method": "getAsset",
                "params": {
                    "id": mintAddress
                }
            }),
        });

        let jsonData = await data.json();
        return jsonData.data;
    } catch (error) {
        console.error("Error fetching token details:", error);
        return null;
    }
}

export const getBalance = async (publickey: PublicKey, connection: Connection) => {
    const balance = (await connection.getBalance(publickey)) / 1e9

    return balance;
}

export const fetchTokenAccounts = async (publickey: PublicKey, network: string) => {
    const response = await fetch(`${network}${API_KEY}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "id": "text",
            "method": "getAssetsByOwner",
            "params": {
                "ownerAddress": publickey.toBase58(),
                "displayOptions": {
                    showFungible: true //return both fungible and non-fungible tokens
                }
            }
        }),
    });
    const data = await response.json();
    return data;
}