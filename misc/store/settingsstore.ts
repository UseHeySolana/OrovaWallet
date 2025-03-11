import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';

interface Settings {
    theme: string;
    notifications: boolean;
    aiVoice: string;
    network: string;
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
}

const AppSettings = create(
    persist<Settings>(
        (set, get) => ({
            theme: "light",
            isLoading: false,
            loadingTimeout: null,
            notifications: true,
            aiVoice: "nova",
            network: "https://devnet.helius-rpc.com/?api-key=",
            alreadyOpened: false,
            skippedAiSettings: false,
            createdWallet: false,
            updateTheme: (newTheme: string) => set({ theme: newTheme }),
            markOpened: () => set({ alreadyOpened: true }),
            markedSkipped: () => set({ skippedAiSettings: true }),
            updateNotifications: (newNotifications: boolean) => set({ notifications: newNotifications }),
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
            setLoading: async (state) => {

                // Clear previous timeout if it exists
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
                // console.log("Rehydrating:", state);
            }
        }
    )
);

export default AppSettings;
