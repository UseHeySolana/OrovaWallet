import { getPublicSettings } from "@/services/settingsApi";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { apiKey: string; at: number } | null = null;
let inflight: Promise<string> | null = null;

function fromEnv(): string {
  return (process.env.EXPO_PUBLIC_HELIUS_API ?? "").trim();
}

/**
 * Helius API key from admin public settings (with env fallback).
 * Prefetch early via {@link prefetchHeliusApiKey}; sync readers use the cache.
 */
export async function getHeliusApiKey(options?: {
  forceRefresh?: boolean;
}): Promise<string> {
  if (
    !options?.forceRefresh &&
    cache &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.apiKey;
  }

  if (!options?.forceRefresh && inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const settings = await getPublicSettings();
      const fromAdmin = (settings.helius_api_key ?? "").trim();
      const apiKey = fromAdmin || fromEnv();
      cache = { apiKey, at: Date.now() };
      return apiKey;
    } catch {
      const apiKey = fromEnv();
      cache = { apiKey, at: Date.now() };
      return apiKey;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Cached/admin key, or env fallback. Prefer {@link getHeliusApiKey} when async is fine. */
export function getHeliusApiKeySync(): string {
  if (cache?.apiKey) return cache.apiKey;
  return fromEnv();
}

/** Warm the cache at app start so sync Connection builders see the admin key. */
export function prefetchHeliusApiKey(): void {
  void getHeliusApiKey();
}

export function clearHeliusApiKeyCache(): void {
  cache = null;
  inflight = null;
}
