import type { App } from "@/libs/app/apps";
import AppCatalog from "@/utils/store/appCatalog.store";
import { getApps } from "@/libs/app/apps";

export function getFeaturedApps(limit = 6): App[] {
  const apps = AppCatalog.getState().apps?.length
    ? AppCatalog.getState().apps
    : getApps();
  return apps.filter((a) => a.is_active && a.is_featured).slice(0, limit);
}
