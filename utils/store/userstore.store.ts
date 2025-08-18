import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';
import { UserType } from '../types/user.types';
import AppSettings from './settingsstore.store';
import WalletItem from './wallet.store';

interface TokenAccount {
  symbol: string;
  balance: number;
  decimals: number;
  image: string;
  mint: string;
  name: string;
}

export interface userWalletType {
  balance: number;
  solBalance: number;
  tokenAccounts: TokenAccount[];
  totalUsdBalance: number;
}
export interface Userstore {
  session: string | null;
  clearData: () => void;
  user: UserType | null;
  setUser: (user: UserType| null) => void;
  logout: () => void;
  userWallet: userWalletType
  updateUserWallet: (userWallet: userWalletType) => void;

}

const UserItem = create(
  persist<Userstore>(
    (set, get) => ({
      session: null,
      user: null,
      userWallet: {
        balance: 0,
        solBalance: 0,
        tokenAccounts: [],
        totalUsdBalance: 0,
      },
      setUser: (user: UserType | null) => set({ user }),
      updateUserWallet: (userWallet: userWalletType) => set({ userWallet }),
      createSession: () => {
        const session = `${Math.random()}${new Date().getTime()}${Math.random()}`;
        set({ session });
      },
      clearData: () => {
        AppSettings.getState().setDefault();
        WalletItem.getState().setDefault();
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
      logout: () => {
        set({ session: null })
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
