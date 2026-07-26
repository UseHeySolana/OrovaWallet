import { BASE_URL } from "@/utils/constant";
import type { RemoteAppRegistration } from "@/libs/app/types";

interface AppsResponse {
  success?: boolean;
  data?: RemoteAppRegistration[];
  meta?: {
    hidden_slugs?: string[];
  };
}

export interface CatalogViewerIdentity {
  wallet_address?: string;
  phone_number?: string;
  email?: string;
}

export interface PublishedAppsResult {
  apps: RemoteAppRegistration[];
  hiddenSlugs: string[];
}

function identityQuery(identity?: CatalogViewerIdentity): string {
  if (!identity) return "";
  const params = new URLSearchParams();
  if (identity.wallet_address) params.set("wallet_address", identity.wallet_address);
  if (identity.phone_number) params.set("phone_number", identity.phone_number);
  if (identity.email) params.set("email", identity.email);
  const qs = params.toString();
  return qs ? `&${qs}` : "";
}

export async function fetchPublishedApps(
  identity?: CatalogViewerIdentity
): Promise<PublishedAppsResult> {
  if (!BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }

  const res = await fetch(
    `${BASE_URL}/apps?per_page=100${identityQuery(identity)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );

  const json = (await res.json().catch(() => ({}))) as AppsResponse;
  if (!res.ok) {
    throw new Error("Failed to fetch published apps");
  }

  return {
    apps: Array.isArray(json.data) ? json.data : [],
    hiddenSlugs: Array.isArray(json.meta?.hidden_slugs)
      ? json.meta!.hidden_slugs!.filter((s): s is string => typeof s === "string")
      : [],
  };
}
