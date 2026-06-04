import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';
import { UserType } from '@/utils/types/user.types';
import AppSettings from '@/utils/store/settingsstore.store';
import WalletItem from '@/utils/store/wallet.store';
import { deleteWalletSecret } from '@/utils/storage/secureStore';

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
  setUser: (user: UserType | null) => void;
  logout: () => void;
  userWallet: userWalletType;
  updateUserWallet: (userWallet: userWalletType) => void;
  /** Unix ms when balances were last fetched from chain; null = must refresh */
  walletLastSyncedAt: number | null;
  setWalletLastSyncedAt: (at: number | null) => void;
  /** null = show all tokens; string[] = only show these mints on wallet screen */
  visibleTokenMints: string[] | null;
  setVisibleTokenMints: (mints: string[] | null) => void;
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
      walletLastSyncedAt: null,
      setWalletLastSyncedAt: (at: number | null) => set({ walletLastSyncedAt: at }),
      visibleTokenMints: null,
      setVisibleTokenMints: (mints: string[] | null) => set({ visibleTokenMints: mints }),
      createSession: () => {
        const session = `${Math.random()}${new Date().getTime()}${Math.random()}`;
        set({ session });
      },
      clearData: () => {
        AppSettings.getState().setDefault();
        WalletItem.getState().setDefault();
        deleteWalletSecret();
        // Clear user state and wallet state
        set({
          user: null,
          userWallet: {
            balance: 0,
            solBalance: 0,
            tokenAccounts: [],
            totalUsdBalance: 0,
          },
          walletLastSyncedAt: null,
          visibleTokenMints: null,
        })
      },
      logout: () => {
        get().clearData();
        set({ session: null });
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
