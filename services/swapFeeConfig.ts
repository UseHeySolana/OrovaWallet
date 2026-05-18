import { getPublicSettings } from "@/services/settingsApi";

export type SwapFeeConfig = {
  referralAccount: string;
  referralFeeBps: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { config: SwapFeeConfig; at: number } | null = null;

function fromEnv(): SwapFeeConfig {
  const referralAccount = (
    process.env.EXPO_PUBLIC_JUP_REFERRAL_ACCOUNT ?? ""
  ).trim();
  const rawBps = Number(process.env.EXPO_PUBLIC_JUP_REFERRAL_FEE_BPS ?? "0");
  const referralFeeBps =
    Number.isFinite(rawBps) && rawBps >= 50
      ? Math.min(255, Math.floor(rawBps))
      : 0;
  return { referralAccount, referralFeeBps };
}

function normalizeBps(bps: number): number {
  if (!Number.isFinite(bps) || bps < 50) return 0;
  return Math.min(255, Math.floor(bps));
}

/**
 * Hey Solana swap integrator fee from admin public settings (with env fallback).
 * Jupiter requires referralAccount + referralFee (50–255 bps) to collect fees.
 */
export async function getSwapFeeConfig(
  options?: { forceRefresh?: boolean }
): Promise<SwapFeeConfig> {
  if (
    !options?.forceRefresh &&
    cache &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.config;
  }

  try {
    const settings = await getPublicSettings();
    const account = (settings.jupiter_referral_account ?? "").trim();
    const bps = normalizeBps(Number(settings.jupiter_referral_fee_bps ?? 0));
    const config: SwapFeeConfig = {
      referralAccount: account,
      referralFeeBps: account && bps >= 50 ? bps : 0,
    };
    if (config.referralAccount && config.referralFeeBps >= 50) {
      cache = { config, at: Date.now() };
      return config;
    }
  } catch {
    // fall through to env
  }

  const envConfig = fromEnv();
  if (envConfig.referralAccount && envConfig.referralFeeBps >= 50) {
    cache = { config: envConfig, at: Date.now() };
    return envConfig;
  }

  const disabled = { referralAccount: "", referralFeeBps: 0 };
  cache = { config: disabled, at: Date.now() };
  return disabled;
}

export function clearSwapFeeConfigCache(): void {
  cache = null;
}
