import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  UserWalletAccount,
  WalletTypeCatalogItem,
} from "@/utils/wallet/accountsApi";
import {
  createUserWallet,
  fetchActiveWalletTypes,
  fetchUserWallets,
  submitWalletKyc,
} from "@/utils/wallet/accountsApi";
import { generateStellarKeypair } from "@/utils/wallet/stellar";
import {
  deleteNamedSecret,
  getNamedSecret,
  setNamedSecret,
} from "@/utils/storage/secureStore";
import UserItem from "@/utils/store/userstore.store";

interface AccountsState {
  accounts: UserWalletAccount[];
  catalog: WalletTypeCatalogItem[];
  activeAccountId: number | null;
  loading: boolean;
  error: string | null;
  setActiveAccountId: (id: number | null) => void;
  refreshCatalog: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  addAccount: (slug: string) => Promise<UserWalletAccount>;
  submitKyc: (
    walletId: number,
    fields: Record<string, string>,
    files?: Record<string, { uri: string; name: string; type: string }>
  ) => Promise<UserWalletAccount>;
  clear: () => void;
}

const AccountsStore = create(
  persist<AccountsState>(
    (set, get) => ({
      accounts: [],
      catalog: [],
      activeAccountId: null,
      loading: false,
      error: null,
      setActiveAccountId: (id) => set({ activeAccountId: id }),
      clear: () =>
        set({
          accounts: [],
          catalog: [],
          activeAccountId: null,
          error: null,
        }),
      refreshCatalog: async () => {
        try {
          const catalog = await fetchActiveWalletTypes();
          set({ catalog, error: null });
        } catch (e) {
          set({
            error: e instanceof Error ? e.message : "Failed to load catalog",
          });
        }
      },
      refreshAccounts: async () => {
        const username = UserItem.getState().user?.username;
        if (!username) return;
        set({ loading: true });
        try {
          const accounts = await fetchUserWallets(username);
          set({ accounts, loading: false, error: null });
          const active = get().activeAccountId;
          if (!active && accounts.length) {
            const primary =
              accounts.find((a) => a.is_primary) ||
              accounts.find((a) => a.type_slug === "solana") ||
              accounts[0];
            set({ activeAccountId: primary.id });
          }
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : "Failed to load wallets",
          });
        }
      },
      addAccount: async (slug: string) => {
        const username = UserItem.getState().user?.username;
        if (!username) throw new Error("Not signed in");

        let address: string | undefined;
        let stellarSecret: string | undefined;
        if (slug === "stellar") {
          const kp = await generateStellarKeypair();
          address = kp.publicKey;
          stellarSecret = kp.secret;
        }

        const wallet = await createUserWallet({
          username,
          wallet_type_slug: slug,
          address,
        });

        if (stellarSecret && wallet.id) {
          await setNamedSecret(`stellarSecret_${wallet.id}`, stellarSecret);
          const pending = await getNamedSecret("stellarSecret_pending");
          if (pending) await deleteNamedSecret("stellarSecret_pending");
        }

        await get().refreshAccounts();
        set({ activeAccountId: wallet.id });
        return wallet;
      },
      submitKyc: async (walletId, fields, files) => {
        const username = UserItem.getState().user?.username;
        if (!username) throw new Error("Not signed in");
        const wallet = await submitWalletKyc({
          username,
          walletId,
          fields,
          files,
        });
        await get().refreshAccounts();
        return wallet;
      },
    }),
    {
      name: "multiwallet-accounts",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) =>
        ({
          accounts: state.accounts,
          activeAccountId: state.activeAccountId,
        }) as AccountsState,
    }
  )
);

export default AccountsStore;
