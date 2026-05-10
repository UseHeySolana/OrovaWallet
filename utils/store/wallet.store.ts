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
            // Rebuild `publicKey` from persisted base58 on startup/refresh.
            // (Mutating `state` inside onRehydrateStorage doesn't reliably notify subscribers.)
            merge: (persistedState: any, currentState: any) => {
              // zustand persist commonly stores { state: {...}, version: n }
              // but some storage adapters/versions may pass the plain state through.
              const persisted =
                persistedState && typeof persistedState === "object" && "state" in persistedState
                  ? (persistedState.state ?? {})
                  : (persistedState ?? {});

              const persistedBase58 = persisted?.publicKeyBase58 ?? null;

              if (typeof persistedBase58 === "string" && persistedBase58.length > 0) {
                try {
                  return {
                    ...currentState,
                    ...persisted,
                    publicKeyBase58: persistedBase58,
                    publicKey: new PublicKey(persistedBase58),
                  };
                } catch {
                  // ignore invalid base58
                }
              }

              return { ...currentState, ...persisted };
            },
        }
    )
);

export default WalletItem;
