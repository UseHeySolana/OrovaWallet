import * as bip39 from 'bip39';

import { derivePath } from 'ed25519-hd-key';
import { storage } from './storage';
import { isJson } from './ai';
import 'react-native-get-random-values';
import { createSolanaRpc } from '@solana/kit';




export const generateMnemonic = async () => {

    return bip39.generateMnemonic();
};


// export const getKeypairFromMnemonic = async (mnemonic: string) => {
//     if (isJson(mnemonic)) {
//         // const keyPair = Keypair?.fromSecretKey(Uint8Array.from(JSON.parse(mnemonic)));
//         const keyPair = web3.Keypair.generate()
//         return keyPair;
//         // return createKeyPairFromBytes(Uint8Array.from(JSON.parse(mnemonic)));
//         // return web3keyPair.fromSecretKey(Uint8Array.from(JSON.parse(mnemonic)));
//     } else {
//         const seed = bip39.mnemonicToSeedSync(mnemonic);
//         const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;

//         // const keyPair = Keypair.fromSeed(derivedSeed);
//         // console.log(keyPair);

//         const keyPair = web3.Keypair.generate()
//         return keyPair;
//     }
// };

// export const getKeyPair = async () => {
//     let mnemonic = await storage.get('mnemonic');

//     if (!mnemonic) {
//         return false;
//     }
//     let keypair = getKeypairFromMnemonic(mnemonic)

//     return keypair;
// }

// export const fetchConversionRate = async (fromCurrency: string) => {

//     try {
//         let data = await fetch(`https://api.jup.ag/price/v2?ids=${fromCurrency}`)
//         let jsonData = await data.json();
//         return jsonData.data[fromCurrency].price;

//     } catch (error) {
//         console.error("Error fetching conversion rate:", error);
//         return null;
//     }

// }

// const API_KEY = process.env.NEXT_PUBLIC_HELIUS_API;
// export const fetchTokenDetails = async (mintAddress: string) => {
//     try {

//         const data = await fetch(`https://mainnet.helius-rpc.com/?api-key=${API_KEY}`, {
//             method: 'POST',
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify({
//                 "jsonrpc": "2.0",
//                 "id": "test",
//                 "method": "getAsset",
//                 "params": {
//                     "id": mintAddress
//                 }
//             }),
//         });

//         let jsonData = await data.json();
//         return jsonData.data;
//     } catch (error) {
//         console.error("Error fetching token details:", error);
//         return null;
//     }
// }

// export const getBalance = async (publickey: web3.PublicKey, connection: web3.Connection) => {
//     const balance = (await connection.getBalance(publickey)) / 1e9

//     return balance;
// }

// export const fetchTokenAccounts = async (publickey: web3.PublicKey, network: string) => {
//     const response = await fetch(`${network}${API_KEY}`, {
//         method: 'POST',
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             "jsonrpc": "2.0",
//             "id": "text",
//             "method": "getAssetsByOwner",
//             "params": {
//                 "ownerAddress": publickey.toBase58(),
//                 "displayOptions": {
//                     showFungible: true //return both fungible and non-fungible tokens
//                 }
//             }
//         }),
//     });
//     const data = await response.json();
//     return data;
// }