import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';
import { UserType } from '../types/usertypes';
import AppSettings from './settingsstore';
import WalletItem from './wallet';

export interface userWalletType {
  balance: number;
  solBalance: number;
  tokenAccounts: [];
  totalUsdBalance: number;
}
export interface Userstore {
  user: UserType | null;
  setUser: (user: UserType) => void;
  logout: () => void;
  userWallet: userWalletType
  updateUserWallet: (userWallet: userWalletType) => void;

}

const UserItem = create(
  persist<Userstore>(
    (set, get) => ({
      user: null,
      userWallet: {
        balance: 0,
        solBalance: 0,
        tokenAccounts: [],
        totalUsdBalance: 0,
      },
      setUser: (user: UserType) => set({ user }),
      updateUserWallet: (userWallet: userWalletType) => set({ userWallet }),
      logout: () => {
        // Clear user data and wallet state
        // AsyncStorage.clear();
        AppSettings.getState().setDefault();
        // WalletItem.getState().setDefault();
        // Clear user state and wallet state
        set({
          user: null,
          userWallet: {
            balance: 0,
            solBalance: 0,
            tokenAccounts: [],
            totalUsdBalance: 0,
          }
        })
      },
    }),
    {
      name: 'user', // Storage key
      storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
      onRehydrateStorage: () => (state) => {
        // console.log("Rehydrating:", state);
      }
    }
  )
);

export default UserItem;
