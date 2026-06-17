import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';
import { getQvacP2pManager } from '@/libs/qvac/qvacP2pManager';
import type { VoiceBackend } from '@/libs/voiceinfra/types';

function defaultVoiceBackend(): VoiceBackend {
    const env = process.env.EXPO_PUBLIC_VOICE_BACKEND;
    if (env === 'qvac' || env === 'openai') return env;
    return 'openai';
}

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
    /** Voice assistant inference backend: OpenAI Realtime or on-device QVAC. */
    voiceBackend: VoiceBackend;
    setVoiceBackend: (backend: VoiceBackend) => void;
    /** User completed the public vs private AI onboarding screen. */
    voiceEngineOnboarded: boolean;
    markVoiceEngineOnboarded: () => void;
    aiLanguage: string;
    setAiLanguage: (language: string) => void;
    network: string;
    networkShort: string;
    aiActive: boolean;
    setAiActive: (active: boolean) => void;
    /** Share on-device QVAC inference with the P2P network and earn points. */
    shareCompute: boolean;
    setShareCompute: (enabled: boolean) => void;
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
    setToast: (message: string, type: "success" | "error" | "info") => void
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
            loadingTimeout: null,
            notifications: true,
            aiVoice: "alloy",
            voiceBackend: defaultVoiceBackend(),
            setVoiceBackend: (backend: VoiceBackend) => set({ voiceBackend: backend }),
            voiceEngineOnboarded: false,
            markVoiceEngineOnboarded: () => set({ voiceEngineOnboarded: true }),
            aiName: "Orova",
            aiLanguage: "English",
            setAiLanguage: (language: string) => set({ aiLanguage: language }),
            aiActive: true,
            setAiActive: (active: boolean) => set({ aiActive: active }),
            shareCompute:
                process.env.EXPO_PUBLIC_QVAC_P2P_ENABLED === "1" ||
                process.env.EXPO_PUBLIC_QVAC_P2P_ENABLED === "true",
            setShareCompute: (enabled: boolean) => {
                set({ shareCompute: enabled });
                void getQvacP2pManager().updateShareCompute(enabled);
            },
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
                set(
                    {
                        theme: "light",
                        isLoading: false,
                        loadingCount: 0,
                        loadingTimeout: null,
                        notifications: true,
                        aiVoice: "alloy",
                        voiceBackend: defaultVoiceBackend(),
                        voiceEngineOnboarded: false,
                        network: "https://mainnet.helius-rpc.com/?api-key=",
                        alreadyOpened: false,
                        skippedAiSettings: false,
                        createdWallet: false,
                    })
            },
            setToast: (message: string, type: "success" | "error" | "info") => {
                set({ toast: { message, type, show: true } })
                setTimeout(() => set({ toast: { show: false, message: "", type: "success" } }), 2000);
            },

            setOpenWithAuth: (val: boolean) => set({ openWithAuth: val }),
            setLoading: (state: boolean) => {
                const LOADING_TIMEOUT_MS = 10000;
                const prev = get();
                const prevTimeout = prev.loadingTimeout;
                const prevCount = prev.loadingCount;

                if (state) {
                    const newCount = prevCount + 1;
                    set({ loadingCount: newCount, isLoading: true });
                    if (newCount === 1) {
                        if (prevTimeout) clearTimeout(prevTimeout);
                        const timeoutId = setTimeout(() => {
                            get().setToast("Something took too long. Please try again.", "error");
                            set({ loadingCount: 0, isLoading: false, loadingTimeout: null });
                        }, LOADING_TIMEOUT_MS);
                        set({ loadingTimeout: timeoutId });
                    }
                } else {
                    const newCount = Math.max(0, prevCount - 1);
                    if (newCount === 0 && prevTimeout) {
                        clearTimeout(prevTimeout);
                    }
                    set({
                        loadingCount: newCount,
                        isLoading: newCount > 0,
                        ...(newCount === 0 ? { loadingTimeout: null } : {}),
                    });
                }
            },

        }),
        {
            name: 'settings', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            partialize: (state) => {
                const { isLoading, loadingCount, loadingTimeout, ...rest } = state;
                return rest;
            },
            onRehydrateStorage: () => (state) => {
            }
        }
    )
);

export default AppSettings;
