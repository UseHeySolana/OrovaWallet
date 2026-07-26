import Constants from "expo-constants";
import { Platform } from "react-native";
import { APP_CAPABILITIES, resolveActionHandler } from "./capabilities";
import type { App, AppToolDefinition, RemoteAppRegistration } from "./types";

function compareSemver(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function isManifestCompatible(manifest: {
  minimum_client_version?: string | null;
  platforms?: string[] | null;
}): boolean {
  const platforms = manifest.platforms?.length ? manifest.platforms : ["ios", "android"];
  const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
  if (!platforms.includes(platform) && !(platform === "web" && platforms.includes("web"))) {
    // Allow unknown platforms for native apps when platforms omit web only.
    if (platform !== "ios" && platform !== "android") return false;
    if (!platforms.includes(platform)) return false;
  }

  const minVersion = manifest.minimum_client_version?.trim();
  if (!minVersion) return true;
  const current =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    "0.0.0";
  return compareSemver(current, minVersion) >= 0;
}

function attachLocalActions(tools?: AppToolDefinition[]): AppToolDefinition[] | undefined {
  if (!tools) return tools;
  return tools.map((tool) => {
    const action = tool.action;
    if (!action) return tool;
    const handler = resolveActionHandler(action.action_id);
    return {
      ...tool,
      action: {
        ...action,
        url: handler ?? action.url,
      },
    };
  });
}

export function remoteToPartialApp(remote: RemoteAppRegistration): App | null {
  if (!remote?.slug || !remote?.name) return null;
  if (remote.status && remote.status !== "published") return null;
  if (!isManifestCompatible(remote)) return null;

  const capability = APP_CAPABILITIES[remote.slug];
  const icon =
    remote.icon_url ||
    capability?.localIcon ||
    "";
  const banner =
    remote.banner_url ||
    capability?.localBanner ||
    "";
  const descriptionImages =
    (remote.description_images?.length
      ? remote.description_images
      : capability?.localDescriptionImages) || [];

  return {
    slug: remote.slug,
    name: remote.name,
    category: remote.category || "Tools",
    short_des: remote.short_description || "",
    description: remote.description || "",
    tutorial: remote.tutorial_url || undefined,
    url: remote.website_url || "",
    tags: remote.tags || [],
    descriptionImages,
    is_active: true,
    is_featured: !!remote.is_featured,
    is_new: !!remote.is_new,
    ratings: Number(remote.ratings ?? 0),
    user_count: Number(remote.user_count ?? 0),
    review_count: Number(remote.review_count ?? 0),
    dashboardRoute: remote.dashboard_route || undefined,
    brand_colors: remote.brand_colors?.primary
      ? {
          primary: remote.brand_colors.primary,
          secondary: remote.brand_colors.secondary || "#0A1825",
        }
      : undefined,
    tools: attachLocalActions(remote.tools || []),
    capability_ids: remote.capability_ids?.length
      ? remote.capability_ids
      : capability?.capabilityIds || [remote.slug],
    minimum_client_version: remote.minimum_client_version,
    platforms: remote.platforms || ["ios", "android"],
    icon_url: remote.icon_url,
    banner_url: remote.banner_url,
    sort_order: remote.sort_order ?? 0,
    icon,
    banner,
  };
}

export function enhanceLocalApp(app: App): App {
  const capability = APP_CAPABILITIES[app.slug];
  return {
    ...app,
    capability_ids: app.capability_ids?.length
      ? app.capability_ids
      : capability?.capabilityIds || [app.slug],
    tools: attachLocalActions(app.tools),
    icon: app.icon || capability?.localIcon || "",
    banner: app.banner || capability?.localBanner || "",
    descriptionImages:
      app.descriptionImages?.length
        ? app.descriptionImages
        : capability?.localDescriptionImages || [],
  };
}

/**
 * Prefer remote published manifests; fill gaps with bundled fallbacks.
 * Unknown remote slugs are still shown as metadata-only apps.
 */
export function mergeCatalog(remoteApps: App[], fallbackApps: App[]): App[] {
  const bySlug = new Map<string, App>();

  for (const fallback of fallbackApps) {
    bySlug.set(fallback.slug, enhanceLocalApp(fallback));
  }

  for (const remote of remoteApps) {
    const local = bySlug.get(remote.slug);
    if (!local) {
      bySlug.set(remote.slug, enhanceLocalApp(remote));
      continue;
    }
    bySlug.set(remote.slug, enhanceLocalApp({
      ...local,
      ...remote,
      icon: remote.icon_url || local.icon,
      banner: remote.banner_url || local.banner,
      descriptionImages:
        remote.descriptionImages?.length ? remote.descriptionImages : local.descriptionImages,
      tools: remote.tools?.length ? remote.tools : local.tools,
      capability_ids: remote.capability_ids?.length
        ? remote.capability_ids
        : local.capability_ids,
    }));
  }

  return Array.from(bySlug.values()).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
  );
}
