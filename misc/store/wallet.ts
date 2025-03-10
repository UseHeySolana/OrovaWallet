import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';
import { Keypair, PublicKey } from '@solana/web3.js';

interface Wallet {
    keypair: Keypair | null;
    publicKey: PublicKey | null;
    updateKeypair: (keypair: Keypair |null) => void;
}

const WalletItem = create(
    persist<Wallet>(
        (set) => ({
            publicKey: null,
            keypair: null,
            updateKeypair: (keypair: Keypair|null) => set({ keypair, publicKey: keypair?.publicKey }),
        }),
        {
            name: 'wallet', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            onRehydrateStorage: () => (state) => {
                console.log("Rehydrating:", state);
            }
        }
    )
);

export default WalletItem;
