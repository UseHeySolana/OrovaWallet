import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';
import { Keypair, PublicKey } from '@solana/web3.js';

interface Wallet {
    addContact: (contact: { name: string; phoneNumber: string, walletAddress: string }) => void;
    addMultipleContacts: (contacts: { name: string; phoneNumber: string, walletAddress: string }[]) => void;
    contacts: { name: string; phoneNumber: string, walletAddress: string }[];
    deleteContact: (index: number) => void;
    editContact: (index: number, newName: string, newPhoneNumber: string, newWalletAddress: string) => void;
    getContacts: () => ({ name: string; phoneNumber: string, walletAddress: string }[]);
}

const PhoneBook = create(
    persist<Wallet>(
        (set, get) => ({
            contacts: [],
            addMultipleContacts: (contacts: { name: string; phoneNumber: string, walletAddress: string }[]) => {
                set({ contacts: [...get().contacts, ...contacts] });
            },
            addContact: (contact: { name: string; phoneNumber: string, walletAddress: string }) => {
                const result = get().contacts.find(item => item.name === contact.name) || null

                console.log(contact)

                if (!result) {
                    set({ contacts: [...get().contacts, contact] });
                } else {
                    return
                }
            },
            deleteContact: (index: number) => {
                set({ contacts: [...get().contacts.slice(0, index), ...get().contacts.slice(index + 1)] });
            },
            editContact: (index: number, newName: string, newPhoneNumber: string, walletAddress: string) => {
                set({ contacts: [...get().contacts.slice(0, index), { name: newName, phoneNumber: newPhoneNumber, walletAddress }, ...get().contacts.slice(index + 1)] });
            },
            getContacts: () => get().contacts,
        }),
        {
            name: 'phonebook', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            onRehydrateStorage: () => (state) => {
                // console.log("Rehydrating:", state);
            }
        }
    )
);

export default PhoneBook;
