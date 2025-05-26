import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';

interface PersonalContact {
    addPersonalContact: (contact: { id: string; name: string; phoneNumber: string, walletAddress: string }) => void;
    addMultiplePersonalContacts: (contacts: { id: string; name: string; phoneNumber: string, walletAddress: string }[]) => void;
    personalContacts: { id: string; name: string; phoneNumber: string, walletAddress: string, type?: "personal" }[];
    deletePersonalContact: (id: string) => void;
    editPersonalContact: (id: string, newName: string, newPhoneNumber: string, newWalletAddress: string) => void;
    refreshPersonalContacts: () => void;
}

const PersonalContacts = create(
    persist<PersonalContact>(
        (set, get) => ({
            personalContacts: [],
            addMultiplePersonalContacts: (contacts: { id: string; name: string; phoneNumber: string, walletAddress: string, type?: "personal" }[]) => {
                // remove duplicates
                const uniqueContacts = contacts.filter((contact, index, self) =>
                    index === self.findIndex((t) => t.name === contact.name)
                );
                set({ personalContacts: [...uniqueContacts] });
            },
            addPersonalContact: (contact: { id: string; name: string; phoneNumber: string, walletAddress: string, type?: "personal" }) => {
                const result = get().personalContacts.find(item => item.name === contact.name) || null;

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
            editPersonalContact: (id: string, newName: string, newPhoneNumber: string, newWalletAddress: string) => {
                const updatedContacts = get().personalContacts.map(contact => {
                    if (contact.id === id) {
                        return {
                            ...contact,
                            name: newName,
                            phoneNumber: newPhoneNumber, 
                            walletAddress: newWalletAddress
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
                console.log(state?.personalContacts)
            }
        }
    )
);

export default PersonalContacts;
