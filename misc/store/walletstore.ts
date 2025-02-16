import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist } from 'zustand/middleware';
import * as Keychain from 'react-native-keychain';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import { generateMnemonic, getKeypairFromMnemonic } from '../helpers/wallet';

const walletStore = create(
    persist(
        (set, get) => ({
            // User Info
            walletAddres: null,
            privateKey: null,
            keyPair: null,
            logout: () => set({ user: null, token: null }),

            setPrivateKey: async (secretKey: Uint8Array) => {
                await Keychain.setGenericPassword("secretKey", bs58.encode(secretKey))
                set({ privateKey: secretKey });
            },

            getKeypair: async () => {
                const secretKey = await Keychain.getGenericPassword("secretkey");
                if (secretKey) {
                    const keypair = Keypair.fromSecretKey(bs58.decode(secretKey.password));
                    set({ keyPair: keypair });
                }
            },

            generateKeypair: async () => {
                const mnemonic = generateMnemonic();
                const keypair = getKeypairFromMnemonic(mnemonic);
                set({ keyPair: keypair });
            }
        }), 
        {
            name: 'wallet-storage', // Storage key
            storage: AsyncStorage as any, // Use AsyncStorage for React Native
        }
    )               
);

export default walletStore;
