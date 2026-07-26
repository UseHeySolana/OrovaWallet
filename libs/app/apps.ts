/**
 * App catalog entrypoint.
 *
 * - Serializable manifests can be managed from the admin dashboard.
 * - Local assets / executable action handlers live in `capabilities.ts`.
 * - `FALLBACK_APPS` keeps the wallet offline-capable.
 * - Prefer `AppCatalog` store for UI so remote updates are reflected.
 */
import AppCatalog from "@/utils/store/appCatalog.store";
import { enhanceLocalApp } from "./mergeManifest";
import { FALLBACK_APPS, categories, reviews } from "./fallbackApps";
import type { App } from "./types";

export type { App, AppManifest, AppToolDefinition } from "./types";
export {
  APP_CAPABILITIES,
  CORE_TOOL_FUNCTION_NAMES,
  DISPLAY_NAME_TO_SLUG,
  getCapability,
  resolveActionHandler,
  resolveAppSlug,
  toImageSource,
} from "./capabilities";
export { FALLBACK_APPS, categories, reviews };

/** Sync snapshot: catalog store if hydrated, otherwise bundled public fallback. */
export function getApps(): App[] {
  const fromStore = AppCatalog.getState().apps;
  if (fromStore?.length) return fromStore;
  return FALLBACK_APPS.filter((app) => app.visibility !== "beta").map(enhanceLocalApp);
}

export function getAppBySlugOrName(slugOrName?: string | null): App | undefined {
  return AppCatalog.getState().getAppBySlugOrName(slugOrName);
}

/**
 * Back-compat export used across the app.
 * Note: this is a live getter snapshot at import-time for array methods that
 * close over the module binding; prefer getApps()/AppCatalog in new code.
 */
const apps: App[] = FALLBACK_APPS.filter((app) => app.visibility !== "beta").map(
  enhanceLocalApp
);

// Keep module-level `apps` roughly in sync when the catalog refreshes.
AppCatalog.subscribe((state) => {
  apps.splice(0, apps.length, ...state.apps);
});

export { apps };
