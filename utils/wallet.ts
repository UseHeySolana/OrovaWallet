import * as bip39 from 'bip39';
import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';
import { storage } from "./storage/storage";

import { PublicKey, Connection, Keypair } from '@solana/web3.js';

const ED25519_CURVE = 'ed25519 seed';
const HARDENED_OFFSET = 0x80000000;
const PATH_REGEX = /^m(\/[0-9]+')+$/;

function replaceDerive(val: string): string {
  return val.replace("'", '');
}

/** SLIP-0010 Ed25519 path derivation (same as ed25519-hd-key, RN-safe) */
function getMasterKeyFromSeed(seedHex: string): { key: Uint8Array; chainCode: Uint8Array } {
  const seedBytes = hexToBytes(seedHex);
  const I = hmac(sha512, ED25519_CURVE, seedBytes);
  return {
    key: I.slice(0, 32),
    chainCode: I.slice(32),
  };
}

function CKDPriv(
  parent: { key: Uint8Array; chainCode: Uint8Array },
  index: number
): { key: Uint8Array; chainCode: Uint8Array } {
  const indexBuffer = new Uint8Array(4);
  indexBuffer[0] = (index >> 24) & 0xff;
  indexBuffer[1] = (index >> 16) & 0xff;
  indexBuffer[2] = (index >> 8) & 0xff;
  indexBuffer[3] = index & 0xff;
  const data = new Uint8Array(1 + parent.key.length + 4);
  data[0] = 0;
  data.set(parent.key, 1);
  data.set(indexBuffer, 1 + parent.key.length);
  const I = hmac(sha512, parent.chainCode, data);
  return {
    key: I.slice(0, 32),
    chainCode: I.slice(32),
  };
}

function derivePath(path: string, seedHex: string): { key: Uint8Array; chainCode: Uint8Array } {
  if (!PATH_REGEX.test(path)) {
    throw new Error('Invalid derivation path');
  }
  const segments = path
    .split('/')
    .slice(1)
    .map(replaceDerive)
    .map((el) => parseInt(el, 10));
  let state = getMasterKeyFromSeed(seedHex);
  for (const segment of segments) {
    state = CKDPriv(state, segment + HARDENED_OFFSET);
  }
  return state;
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export const isJson = (str: any) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}




export const generateMnemonic = async () => {
    try {

        const bip = bip39.generateMnemonic();
        return bip
    } catch (e) {
        console.log('error', e)
        return null
    }
};
export const getKeypairFromMnemonic = async (mnemonic: string): Promise<Keypair> => {
    try {
        if (isJson(mnemonic)) {
            const keyPair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(mnemonic)));
            return keyPair;
        } else {
            const seed = bip39.mnemonicToSeedSync(mnemonic);
            const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
            const keyPair = Keypair.fromSeed(derivedSeed);
            return keyPair;
        }
    } catch (error) {
        console.error("Error generating keypair from mnemonic:", error);
        throw error;
    }
};



export const fetchConversionRate = async (fromCurrency: string) => {
    try {
        let data = await fetch(
          `https://lite-api.jup.ag/price/v3?ids=${fromCurrency}`
        );
        let jsonData = await data.json();
        console.log(jsonData);
        return jsonData[fromCurrency].usdPrice;

    } catch (error) {
        console.error("Error fetching conversion rate:", error);
        return null;
    }

}

const API_KEY = process.env.EXPO_PUBLIC_HELIUS_API;

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