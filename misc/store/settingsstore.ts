import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';
import { Connection } from '@solana/web3.js';

interface Settings {
    ek: {
        value: string;
        expiry: number;
    }
    theme: string;
    notifications: boolean;
    aiVoice: string;
    network: string;
    aiName: string;
    setAiName: (name: string) => void;
    alreadyOpened: boolean;
    updateTheme: (newTheme: string) => void;
    markOpened: () => void;
    markedSkipped: () => void;
    skippedAiSettings: boolean,
    createdWallet: boolean,
    updateNotifications: (newNotifications: boolean) => void;
    updateAiVoice: (newAiVoice: string) => void;
    setDefault: () => void;
    isLoading: boolean,
    setLoading: (state: boolean) => void
    loadingTimeout: any,
    setEk: (value: string, expiry: number) => void
    toast: {
        show: boolean,
        message: string,
        type: "success" | "error" | "info",
    },
    setToast: (message: string, type: "success" | "error" | "info") => void
}


const AppSettings = create(
    persist<Settings>(
        (set, get) => ({
            ek: {
                value: "",
                expiry: 0,
            },
            theme: "light",
            isLoading: false,
            toast: {
                show: false,
                message: "",
                type: "success"
            },
            loadingTimeout: null,
            notifications: true,
            aiVoice: "alloy",
            aiName: "HeySolana",
            network: "https://mainnet.helius-rpc.com/?api-key=",
            alreadyOpened: false,
            skippedAiSettings: false,
            createdWallet: false,
            setEk: (value: string, expiry: number) => set({ ek: { value, expiry } }),
            updateTheme: (newTheme: string) => set({ theme: newTheme }),
            markOpened: () => set({ alreadyOpened: true }),
            markedSkipped: () => set({ skippedAiSettings: true }),
            updateNotifications: (newNotifications: boolean) => set({ notifications: newNotifications }),
            setAiName: (name: string) => set({ aiName: name }),
            updateAiVoice: (newAiVoice: string) => set({ aiVoice: newAiVoice }),
            setDefault: () => {
                // reset the default settings
                set(
                    {
                        theme: "light",
                        isLoading: false,
                        loadingTimeout: null,
                        notifications: true,
                        aiVoice: "nova",
                        network: "https://devnet.helius-rpc.com/?api-key=",
                        alreadyOpened: false,
                        skippedAiSettings: false,
                        createdWallet: false,
                    })
            },
            setToast: (message: string, type: "success" | "error" | "info") => {
                set({ toast: { message, type, show: true } })
                setTimeout(() => set({ toast: { show: false, message: "", type: "success" } }), 1000);
            },

            setLoading: async (state) => {


                const previousTimeout = get().loadingTimeout;
                if (previousTimeout) {
                    clearTimeout(previousTimeout);
                }

                // Update loading state
                set({ isLoading: state });

                if (state) {
                    // Set a new timeout and store its ID
                    const timeoutId = setTimeout(() => {
                        set({ isLoading: false, loadingTimeout: null });
                    }, 10000);

                    set({ loadingTimeout: timeoutId });
                } else {
                    // If manually turning off loading, clear any pending timeout
                    set({ loadingTimeout: null });
                }
                await new Promise(resolve => setTimeout(resolve, 100));

            }

        }),
        {
            name: 'settings', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            onRehydrateStorage: () => (state) => {
                console.log("Rehydrating:", state?.ek);
            }
        }
    )
);

export default AppSettings;
