import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";
import { FALLBACK_APPS } from "@/libs/app/fallbackApps";
import {
  enhanceLocalApp,
  mergeCatalog,
  remoteToPartialApp,
} from "@/libs/app/mergeManifest";
import { resolveAppSlug } from "@/libs/app/capabilities";
import type { App, RemoteAppRegistration } from "@/libs/app/types";
import { fetchPublishedApps } from "@/services/appCatalogApi";
import ToolsItem from "@/utils/store/toolsitems.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";

interface AppCatalogStore {
  apps: App[];
  source: "fallback" | "remote" | "cache";
  lastFetchedAt: number | null;
  lastIdentityKey: string | null;
  loading: boolean;
  error: string | null;
  hiddenSlugs: string[];
  hydrateFromFallback: () => void;
  refreshCatalog: (opts?: { force?: boolean }) => Promise<App[]>;
  getAppBySlugOrName: (slugOrName?: string | null) => App | undefined;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

function viewerIdentity() {
  const wallet =
    WalletItem.getState().publicKeyBase58 ||
    WalletItem.getState().publicKey?.toBase58() ||
    "";
  const user = UserItem.getState().user;
  const phone =
    user?.phoneE164?.trim() || user?.mobileNumber?.trim() || "";
  const email = user?.email?.trim() || "";

  return {
    wallet_address: wallet || undefined,
    phone_number: phone || undefined,
    email: email || undefined,
  };
}

function identityKeyFrom(identity: {
  wallet_address?: string;
  phone_number?: string;
  email?: string;
}): string {
  return [
    identity.wallet_address?.toLowerCase() || "",
    identity.phone_number || "",
    identity.email?.toLowerCase() || "",
  ].join("|");
}

/** Deactivate tools for apps the viewer is no longer allowed to see. */
function revokeHiddenActivations(hiddenSlugs: string[]) {
  if (!hiddenSlugs.length) return;
  const hidden = new Set(hiddenSlugs);
  const { tools, updateToolStatus } = ToolsItem.getState();
  for (const tool of tools) {
    if (tool.value !== "active") continue;
    const slug = resolveAppSlug(tool.name) || tool.name;
    if (hidden.has(slug)) {
      updateToolStatus(tool.name, "inactive");
    }
  }
}

const publicFallbackApps = (): App[] =>
  FALLBACK_APPS.filter((app) => app.visibility !== "beta").map(enhanceLocalApp);

const AppCatalog = create<AppCatalogStore>()(
  persist(
    (set, get) => ({
      apps: publicFallbackApps(),
      source: "fallback",
      lastFetchedAt: null,
      lastIdentityKey: null,
      loading: false,
      error: null,
      hiddenSlugs: [],

      hydrateFromFallback: () => {
        set({
          apps: publicFallbackApps(),
          source: "fallback",
          hiddenSlugs: [],
        });
      },

      refreshCatalog: async (opts) => {
        const { lastFetchedAt, lastIdentityKey, apps, loading } = get();
        if (loading) return apps;

        const identity = viewerIdentity();
        const identityKey = identityKeyFrom(identity);
        const identityChanged = lastIdentityKey !== identityKey;

        if (
          !opts?.force &&
          !identityChanged &&
          lastFetchedAt &&
          Date.now() - lastFetchedAt < CACHE_TTL_MS &&
          apps.length > 0
        ) {
          return apps;
        }

        set({ loading: true, error: null });
        try {
          const { apps: remotePayload, hiddenSlugs } = await fetchPublishedApps(
            identity
          );
          const remoteApps = remotePayload
            .map((item: RemoteAppRegistration) => remoteToPartialApp(item))
            .filter((item): item is App => !!item);
          const merged = mergeCatalog(remoteApps, FALLBACK_APPS, { hiddenSlugs });
          revokeHiddenActivations(hiddenSlugs);
          set({
            apps: merged,
            source: "remote",
            lastFetchedAt: Date.now(),
            lastIdentityKey: identityKey,
            loading: false,
            error: null,
            hiddenSlugs,
          });
          return merged;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to refresh app catalog";
          if (__DEV__) {
            console.warn("[appCatalog]", message);
          }
          const fallback =
            get().apps.length > 0
              ? get().apps.filter((app) => !get().hiddenSlugs.includes(app.slug))
              : publicFallbackApps();
          set({
            apps: fallback,
            source: get().lastFetchedAt ? "cache" : "fallback",
            loading: false,
            error: message,
          });
          return fallback;
        }
      },

      getAppBySlugOrName: (slugOrName) => {
        if (!slugOrName) return undefined;
        const slug = resolveAppSlug(slugOrName) || slugOrName;
        return get().apps.find(
          (app) =>
            app.slug === slug ||
            app.name === slugOrName ||
            app.slug === slugOrName
        );
      },
    }),
    {
      name: "app-catalog-v2",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        apps: state.apps,
        source: state.source,
        lastFetchedAt: state.lastFetchedAt,
        lastIdentityKey: state.lastIdentityKey,
        hiddenSlugs: state.hiddenSlugs,
      }),
    }
  )
);

export default AppCatalog;
