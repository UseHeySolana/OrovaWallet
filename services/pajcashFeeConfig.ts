import { getPublicSettings } from "@/services/settingsApi";

export type PajCashFeeConfig = {
  onrampUsdcFee: number;
  offrampUsdcFee: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { config: PajCashFeeConfig; at: number } | null = null;

function normalizeUsdcFee(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric;
}

function fromEnv(): PajCashFeeConfig {
  return {
    onrampUsdcFee: normalizeUsdcFee(
      process.env.EXPO_PUBLIC_PAJCASH_ONRAMP_USDC_FEE ?? "0"
    ),
    offrampUsdcFee: normalizeUsdcFee(
      process.env.EXPO_PUBLIC_PAJCASH_OFFRAMP_USDC_FEE ?? "0"
    ),
  };
}

/**
 * Hey Solana integrator fee for PajCash onramp/offramp (businessUSDCFee on the wire).
 * Configured in admin settings; wallet passes it as `fee` to the paj_ramp SDK.
 */
export async function getPajCashFeeConfig(options?: {
  forceRefresh?: boolean;
}): Promise<PajCashFeeConfig> {
  if (
    !options?.forceRefresh &&
    cache &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.config;
  }

  try {
    const settings = await getPublicSettings();
    const config: PajCashFeeConfig = {
      onrampUsdcFee: normalizeUsdcFee(settings.pajcash_onramp_usdc_fee),
      offrampUsdcFee: normalizeUsdcFee(settings.pajcash_offramp_usdc_fee),
    };
    cache = { config, at: Date.now() };
    return config;
  } catch {
    const envConfig = fromEnv();
    cache = { config: envConfig, at: Date.now() };
    return envConfig;
  }
}

export async function getPajCashBusinessUsdcFee(
  flow: "onramp" | "offramp"
): Promise<number> {
  const config = await getPajCashFeeConfig();
  return flow === "onramp" ? config.onrampUsdcFee : config.offrampUsdcFee;
}

export function clearPajCashFeeConfigCache(): void {
  cache = null;
}
