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

interface AppCatalogStore {
  apps: App[];
  source: "fallback" | "remote" | "cache";
  lastFetchedAt: number | null;
  loading: boolean;
  error: string | null;
  hydrateFromFallback: () => void;
  refreshCatalog: (opts?: { force?: boolean }) => Promise<App[]>;
  getAppBySlugOrName: (slugOrName?: string | null) => App | undefined;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

const AppCatalog = create<AppCatalogStore>()(
  persist(
    (set, get) => ({
      apps: FALLBACK_APPS.map(enhanceLocalApp),
      source: "fallback",
      lastFetchedAt: null,
      loading: false,
      error: null,

      hydrateFromFallback: () => {
        set({
          apps: FALLBACK_APPS.map(enhanceLocalApp),
          source: "fallback",
        });
      },

      refreshCatalog: async (opts) => {
        const { lastFetchedAt, apps, loading } = get();
        if (loading) return apps;
        if (
          !opts?.force &&
          lastFetchedAt &&
          Date.now() - lastFetchedAt < CACHE_TTL_MS &&
          apps.length > 0
        ) {
          return apps;
        }

        set({ loading: true, error: null });
        try {
          const remotePayload = await fetchPublishedApps();
          const remoteApps = remotePayload
            .map((item: RemoteAppRegistration) => remoteToPartialApp(item))
            .filter((item): item is App => !!item);
          const merged = mergeCatalog(remoteApps, FALLBACK_APPS);
          set({
            apps: merged,
            source: "remote",
            lastFetchedAt: Date.now(),
            loading: false,
            error: null,
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
              ? get().apps
              : FALLBACK_APPS.map(enhanceLocalApp);
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
      name: "app-catalog-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        apps: state.apps,
        source: state.source,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);

export default AppCatalog;
