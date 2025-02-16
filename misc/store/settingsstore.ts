import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';
import { UserType } from '@/misc/types/usertypes';

interface Settings {
    theme: string;
    notifications: boolean;
    aiVoice: string;
    network: "mainnet" | "devnet";
    alreadyOpened: boolean;
    updateTheme: (newTheme:string) => void;
    markOpened: () => void;
    updateNotifications: (newNotifications: boolean) => void;
    updateAiVoice: (newAiVoice: string) => void;
    setDefault: () => void;
}

const AppSettings = create(
    persist<Settings>(
        (set) => ({
            theme: "light",
            notifications: true,
            aiVoice: "nova",
            network: "devnet",
            alreadyOpened: false,
            updateTheme: (newTheme: string) => set({ theme: newTheme }),
            markOpened:()=>set({alreadyOpened: true}),
            updateNotifications: (newNotifications: boolean) => set({ notifications: newNotifications }),
            updateAiVoice: (newAiVoice: string) => set({ aiVoice: newAiVoice }),
            setDefault: () => set({ theme: "light", notifications: true, aiVoice: "nova",network: "mainnet" })
        }),
        {
            name: 'settings', // Storage key
            storage:createJSONStorage(()=> AsyncStorage), // Use AsyncStorage for React Native
            onRehydrateStorage: () => (state) => {
                console.log("Rehydrating:", state);
            }
        }
    )
);

export default AppSettings;
