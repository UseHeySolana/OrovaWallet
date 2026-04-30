import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Keypair, PublicKey } from '@solana/web3.js';

interface Wallet {
    keypair: Keypair | null;
    publicKey: PublicKey | null;
    publicKeyBase58: string | null;
    passphrase: string | null;
    updateKeypair: (keypair: Keypair |null) => void;
    setDefault: () => void;
    updatePassphrase: (passphrase: string|null) => void;
}

const WalletItem = create(
    persist<Wallet>(
        (set, get) => ({
            passphrase: null,
            updatePassphrase: (passphrase: string|null) => set({ passphrase }),
            publicKey: null,
            publicKeyBase58: null,
            keypair: null,
            updateKeypair: (keypair: Keypair|null) =>
              set({
                keypair,
                publicKey: keypair?.publicKey ?? null,
                publicKeyBase58: keypair?.publicKey?.toBase58() ?? null,
              }),
            setDefault: () => {
                set({ keypair: null, publicKey: null, publicKeyBase58: null, passphrase: null });
            }
        }),
        {
            name: 'wallet', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            partialize: (state) =>
              ({
                // Never persist secrets.
                publicKeyBase58: state.publicKeyBase58,
              }) as unknown as Wallet,
            onRehydrateStorage: () => (state) => {
              const base58 = state?.publicKeyBase58;
              if (base58 && !state.publicKey) {
                try {
                  state.publicKey = new PublicKey(base58);
                } catch {
                  // ignore
                }
              }
            },
        }
    )
);

export default WalletItem;
