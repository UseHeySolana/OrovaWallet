import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';

interface PersonalContact {
    addPersonalContact: (contact: { name: string; phoneNumber: string, walletAddress: string }) => void;
    addMultiplePersonalContacts: (contacts: { name: string; phoneNumber: string, walletAddress: string }[]) => void;
    personalContacts: { name: string; phoneNumber: string, walletAddress: string, type?: "personal" }[];
    deletePersonalContact: (index: number) => void;
    editPersonalContact: (index: number, newName: string, newPhoneNumber: string, newWalletAddress: string) => void;
}

const PersonalContacts = create(
    persist<PersonalContact>(
        (set, get) => ({
            personalContacts: [],
            addMultiplePersonalContacts: (contacts: { name: string; phoneNumber: string, walletAddress: string, type?: "personal" }[]) => {
                // remove duplicates
                const uniqueContacts = contacts.filter((contact, index, self) =>
                    index === self.findIndex((t) => t.name === contact.name)
                );
                set({ personalContacts: [...uniqueContacts] });
            },
            addPersonalContact: (contact: { name: string; phoneNumber: string, walletAddress: string, type?: "personal" }) => {
                // set({personalContacts:[]})
                const result = get().personalContacts.find(item => item.name === contact.name) || null;

                if (!result) {
                    set({ personalContacts: [...get().personalContacts, contact] });
                } else {
                    return
                }
            },
            deletePersonalContact: (index: number) => {
                set({ personalContacts: [...get().personalContacts.slice(0, index), ...get().personalContacts.slice(index + 1)] });
            },
            editPersonalContact: (index: number, newName: string, newPhoneNumber: string, walletAddress: string) => {
                set({ personalContacts: [...get().personalContacts.slice(0, index), { name: newName, phoneNumber: newPhoneNumber, walletAddress }, ...get().personalContacts.slice(index + 1)] });
            },
        }),
        {
            name: 'personalcontacts', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            onRehydrateStorage: () => (state) => {
            }
        }
    )
);

export default PersonalContacts;
