import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';

interface Settings {
    pin: string;
    setPin: (pin: string) => void;
    openWithAuth: boolean;
    ek: {
        value: string;
        expiry: number;
    }
    theme: string;
    notifications: boolean;
    aiVoice: string;
    aiLanguage: string;
    setAiLanguage: (language: string) => void;
    network: string;
    networkShort: string;
    aiActive: boolean;
    setAiActive: (active: boolean) => void;
    changeNetwork: (network: string) => void;
    aiName: string;
    setAiName: (name: string) => void;
    alreadyOpened: boolean;
    updateTheme: (newTheme: string) => void;
    markOpened: () => void;
    markedSkipped: () => void;
    skippedAiSettings: boolean,
    createdWallet: boolean,
    updateNotifications: (newNotifications: boolean) => void;
    promptWalletBackup: boolean,
    setPromptWalletBackup: (value: boolean) => void,
    updateAiVoice: (newAiVoice: string) => void;
    setDefault: () => void;

    isLoading: boolean,
    loadingCount: number,
    setLoading: (state: boolean) => void
    loadingTimeout: ReturnType<typeof setTimeout> | null,
    setEk: (value: string, expiry: number) => void
    toast: {
        show: boolean,
        message: string,
        type: "success" | "error" | "info",
    },
    toastTimeout: ReturnType<typeof setTimeout> | null,
    setToast: (message: string, type: "success" | "error" | "info") => void
    clearToast: () => void
    setOpenWithAuth: (val: boolean) => void,
    refresher: number,
    setRefresher: (refresher: number) => void
    pinReminder: number | null,
    setPinReminder: (reminder: number) => void
}


const AppSettings = create(
    persist<Settings>(
        (set, get) => ({
            pinReminder: null,
            setPinReminder: (reminder: number) => set({ pinReminder: reminder }),
            pin: "",
            setPin: (pin: string) => set({ pin: pin }),
            refresher: 0,
            setRefresher: (refresher: number) => set({ refresher: refresher }),
            openWithAuth: false,
            ek: {
                value: "",
                expiry: 0,
            },
            theme: "light",
            isLoading: false,
            loadingCount: 0,
            toast: {
                show: false,
                message: "",
                type: "success"
            },
            toastTimeout: null,
            loadingTimeout: null,
            notifications: true,
            aiVoice: "alloy",
            aiName: "Orova",
            aiLanguage: "English",
            setAiLanguage: (language: string) => set({ aiLanguage: language }),
            aiActive: true,
            setAiActive: (active: boolean) => set({ aiActive: active }),
            network: "https://mainnet.helius-rpc.com/?api-key=",
            changeNetwork: (network: string) => {
                const net = network == 'mainnet' ? "https://mainnet.helius-rpc.com/?api-key=" : "https://devnet.helius-rpc.com/?api-key="
                set({ network: net })
                set({ networkShort: network })


            },
            networkShort: 'mainnet',

            alreadyOpened: false,
            skippedAiSettings: false,
            createdWallet: false,
            promptWalletBackup: false,
            setPromptWalletBackup: (value: boolean) => set({ promptWalletBackup: value }),
            setEk: (value: string, expiry: number) => set({ ek: { value, expiry } }),
            updateTheme: (newTheme: string) => set({ theme: newTheme }),
            markOpened: () => set({ alreadyOpened: true }),
            markedSkipped: () => set({ skippedAiSettings: true }),
            updateNotifications: (newNotifications: boolean) => set({ notifications: newNotifications }),
            setAiName: (name: string) => set({ aiName: name }),
            updateAiVoice: (newAiVoice: string) => set({ aiVoice: newAiVoice }),
            setDefault: () => {
                // reset the default settings
                const prev = get();
                if (prev.loadingTimeout) clearTimeout(prev.loadingTimeout);
                if (prev.toastTimeout) clearTimeout(prev.toastTimeout);
                set(
                    {
                        theme: "light",
                        isLoading: false,
                        loadingCount: 0,
                        loadingTimeout: null,
                        toast: { show: false, message: "", type: "success" },
                        toastTimeout: null,
                        notifications: true,
                        aiVoice: "alloy",
                        network: "https://mainnet.helius-rpc.com/?api-key=",
                        alreadyOpened: false,
                        skippedAiSettings: false,
                        createdWallet: false,
                        promptWalletBackup: false,
                    })
            },
            clearToast: () => {
                const prev = get().toastTimeout;
                if (prev) clearTimeout(prev);
                set({
                    toast: { show: false, message: "", type: "success" },
                    toastTimeout: null,
                });
            },
            setToast: (message: string, type: "success" | "error" | "info") => {
                const prev = get().toastTimeout;
                if (prev) clearTimeout(prev);

                // Errors stay a bit longer so users can read them.
                const durationMs = type === "error" ? 4000 : type === "info" ? 3000 : 2500;
                const timeoutId = setTimeout(() => {
                    get().clearToast();
                }, durationMs);

                set({
                    toast: { message, type, show: true },
                    toastTimeout: timeoutId,
                });
            },

            setOpenWithAuth: (val: boolean) => set({ openWithAuth: val }),
            setLoading: (state: boolean) => {
                const LOADING_TIMEOUT_MS = 90_000;
                const prev = get();
                const prevTimeout = prev.loadingTimeout;
                const prevCount = prev.loadingCount;

                if (state) {
                    const newCount = prevCount + 1;
                    if (prevTimeout) clearTimeout(prevTimeout);
                    const timeoutId = setTimeout(() => {
                        const current = get();
                        if (current.loadingCount <= 0) return;
                        get().setToast("Something took too long. Please try again.", "error");
                        set({ loadingCount: 0, isLoading: false, loadingTimeout: null });
                    }, LOADING_TIMEOUT_MS);
                    set({ loadingCount: newCount, isLoading: true, loadingTimeout: timeoutId });
                } else {
                    const newCount = Math.max(0, prevCount - 1);
                    if (newCount === 0 && prevTimeout) {
                        clearTimeout(prevTimeout);
                    }
                    set({
                        loadingCount: newCount,
                        isLoading: newCount > 0,
                        loadingTimeout: newCount === 0 ? null : prevTimeout,
                    });
                }
            },

        }),
        {
            name: 'settings', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            partialize: (state) => {
                const {
                    isLoading,
                    loadingCount,
                    loadingTimeout,
                    promptWalletBackup,
                    toast,
                    toastTimeout,
                    ...rest
                } = state;
                return rest;
            },
            onRehydrateStorage: () => (state) => {
                // Never restore a sticky toast from disk.
                if (state) {
                    state.toast = { show: false, message: "", type: "success" };
                    state.toastTimeout = null;
                }
            }
        }
    )
);

export default AppSettings;
