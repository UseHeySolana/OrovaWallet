import { Platform } from "react-native";

/** App catalog slug for PajCash fiat on/off-ramp. */
export const FIAT_EXCHANGE_APP_SLUG = "pajcash";

/**
 * Fiat on-ramp / off-ramp (PajCash) is disabled on iOS for App Store
 * Guideline 3.1.5(iii). Non-custodial wallet + on-chain swaps remain available.
 */
export function isFiatExchangeEnabled(): boolean {
  return Platform.OS !== "ios";
}

/** Drop fiat-exchange apps from catalogs on platforms where they are disabled. */
export function filterFiatExchangeApps<T extends { slug?: string | null }>(
  apps: T[]
): T[] {
  if (isFiatExchangeEnabled()) return apps;
  return apps.filter(
    (app) => (app.slug ?? "").toLowerCase() !== FIAT_EXCHANGE_APP_SLUG
  );
}
