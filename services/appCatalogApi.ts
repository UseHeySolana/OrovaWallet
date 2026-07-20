import { BASE_URL } from "@/utils/constant";
import type { RemoteAppRegistration } from "@/libs/app/types";

interface AppsResponse {
  success?: boolean;
  data?: RemoteAppRegistration[];
}

export async function fetchPublishedApps(): Promise<RemoteAppRegistration[]> {
  if (!BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }

  const res = await fetch(`${BASE_URL}/apps?per_page=100`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const json = (await res.json().catch(() => ({}))) as AppsResponse;
  if (!res.ok) {
    throw new Error("Failed to fetch published apps");
  }

  return Array.isArray(json.data) ? json.data : [];
}
