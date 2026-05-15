const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const AIRBILLS = process.env.EXPO_PUBLIC_AIR_BILLS || "";
const HELIUS = process.env.EXPO_PUBLIC_HELIUS_API || "";
const SCRAPER_API_KEY = process.env.EXPO_PUBLIC_SCRAPER_API_KEY || "";
const CROSSMINT_API_KEY = process.env.EXPO_PUBLIC_CROSSMINT || "";
/** Fallback treasury wallet when admin settings are unavailable. Primary treasury is fetched from GET /settings/public. */
const JUMIA_USDC_TREASURY = process.env.EXPO_PUBLIC_JUMIA_USDC_TREASURY || "";
const PASSKEY_RP_ID = process.env.EXPO_PUBLIC_PASSKEY_RP_ID || "hey.yraytestings.com.ng";

export {
  BASE_URL,
  AIRBILLS,
  HELIUS,
  SCRAPER_API_KEY,
  CROSSMINT_API_KEY,
  JUMIA_USDC_TREASURY,
  PASSKEY_RP_ID,
};