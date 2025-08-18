import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';

interface PersonalContact {
    addPersonalContact: (contact: { id: string; username: string; phone_number: string, wallet_address: string, type?: "personal" | "business" }) => void;
    addMultiplePersonalContacts: (contacts: { id: string; username: string; phone_number: string, wallet_address: string, type?: "personal" | "business" }[]) => void;
    personalContacts: { id: string; username: string; phone_number: string, wallet_address: string, type?: "personal" | "business" }[];
    deletePersonalContact: (id: string) => void;
        editPersonalContact: (id: string, newUsername: string, newPhoneNumber: string, newWalletAddress: string, newType: "personal" | "business") => void;
    refreshPersonalContacts: () => void;
}

const PersonalContacts = create(
    persist<PersonalContact>(
        (set, get) => ({
            personalContacts: [],
            addMultiplePersonalContacts: (contacts: { id: string; username: string; phone_number: string, wallet_address: string, type?: "personal" | "business" }[]) => {
                // remove duplicates
                const uniqueContacts = contacts.filter((contact, index, self) =>
                    index === self.findIndex((t) => t.username === contact.username)
                );
                set({ personalContacts: [...uniqueContacts] });
            },
            addPersonalContact: (contact: { id: string; username: string; phone_number: string, wallet_address: string, type?: "personal" | "business" }) => {
                const result = get().personalContacts.find(item => item.username === contact.username) || null;

                if (!result) {
                    set({ personalContacts: [...get().personalContacts, contact] });
                } else {
                    return
                }
            },
            deletePersonalContact: (id: string) => {
                const filteredContacts = get().personalContacts.filter(contact => contact.id !== id);
                set({ personalContacts: filteredContacts });
            },
            editPersonalContact: (id: string, newUsername: string, newPhoneNumber: string, newWalletAddress: string, newType: "personal" | "business") => {
                const updatedContacts = get().personalContacts.map(contact => {
                    if (contact.id === id) {
                        return {
                            ...contact,
                            username: newUsername,
                            phone_number: newPhoneNumber,
                            wallet_address: newWalletAddress,
                            type: newType
                        };
                    }
                    return contact;
                });

                set({ personalContacts: updatedContacts });
            },
            refreshPersonalContacts: () => {
                set({ personalContacts: [] });
            }
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
