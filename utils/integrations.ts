import { apps, type App } from "@/libs/app/apps";

export function getFeaturedApps(limit = 6): App[] {
  return apps.filter((a) => a.is_active && a.is_featured).slice(0, limit);
}
