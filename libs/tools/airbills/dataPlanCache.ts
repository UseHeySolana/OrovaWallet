import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InternetPlan } from "@/libs/tools/airbills/airbills";

const CACHE_PREFIX = "airbills_data_plans:";
const CACHE_TTL_MS = 72 * 60 * 60 * 1000;

export type CachedInternetPlansPayload = {
  fetchedAt: number;
  batch: string;
  plans: InternetPlan[];
  networkId: string;
  cachedAt?: string;
};

function cacheKey(networkId: string) {
  return `${CACHE_PREFIX}${networkId}`;
}

export function isDataPlanCacheFresh(
  entry: CachedInternetPlansPayload | null
): entry is CachedInternetPlansPayload {
  if (!entry?.fetchedAt || !Array.isArray(entry.plans)) return false;
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

export async function readCachedDataPlans(
  networkId: string
): Promise<CachedInternetPlansPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(networkId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedInternetPlansPayload;
    return isDataPlanCacheFresh(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeCachedDataPlans(
  networkId: string,
  payload: Omit<CachedInternetPlansPayload, "fetchedAt"> & {
    fetchedAt?: number;
  }
): Promise<void> {
  try {
    const entry: CachedInternetPlansPayload = {
      ...payload,
      networkId,
      fetchedAt: payload.fetchedAt ?? Date.now(),
    };
    await AsyncStorage.setItem(cacheKey(networkId), JSON.stringify(entry));
  } catch {
    // Cache write failures should not break plan loading.
  }
}

export async function readStaleCachedDataPlans(
  networkId: string
): Promise<CachedInternetPlansPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(networkId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedInternetPlansPayload;
    return Array.isArray(parsed?.plans) ? parsed : null;
  } catch {
    return null;
  }
}
