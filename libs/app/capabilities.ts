import { ImageSource } from "expo-image";
import { airBills } from "@/libs/tools/airbills/airbills";
import { magicblock } from "@/libs/tools/magicblock/magicblock";
import type { AppImage } from "./types";

export type CapabilityId =
  | "crossmint"
  | "airbills"
  | "pajcash"
  | "jupiter"
  | "heysolana"
  | "chowdeck"
  | "jumia"
  | "kalshi"
  | "bayse"
  | "magicblock";

export interface AppCapability {
  slug: string;
  /** Legacy display-name keys used in AsyncStorage before slug migration. */
  legacyNames: string[];
  capabilityIds: CapabilityId[];
  /** Tool function names owned by this app (for runtime registration filtering). */
  toolFunctionNames: string[];
  localIcon?: AppImage;
  localBanner?: AppImage;
  localDescriptionImages?: AppImage[];
  core?: boolean;
}

export const ACTION_HANDLERS: Record<string, (...args: any[]) => any> = {
  "airbills.verify_meter": airBills.electricity.verifyMeter,
  "magicblock.health": magicblock.health,
};

export const APP_CAPABILITIES: Record<string, AppCapability> = {
  crossmint: {
    slug: "crossmint",
    legacyNames: ["Crossmint"],
    capabilityIds: ["crossmint"],
    toolFunctionNames: [
      "search-products-amazon",
      "create-order",
      "product-details",
    ],
    localIcon: require("@/assets/apps/crossmint/logo.png"),
    localBanner: require("@/assets/apps/crossmint/banner.png"),
  },
  airbills: {
    slug: "airbills",
    legacyNames: ["Airbills"],
    capabilityIds: ["airbills"],
    toolFunctionNames: ["buy-airtime", "buy-electricity-bill", "buy-data-bundle"],
    localIcon: require("@/assets/apps/airbillslogo.jpg"),
    localBanner: require("@/assets/apps/airbillsbg.jpeg"),
  },
  pajcash: {
    slug: "pajcash",
    legacyNames: ["Pajcash"],
    capabilityIds: ["pajcash"],
    toolFunctionNames: [
      "pajcash-initiate-session",
      "pajcash-verify-session",
      "pajit-offramp",
      "pajcash-onramp",
      "get-naira-rate",
    ],
    localIcon: require("@/assets/apps/pajcas.jpg"),
    localBanner: require("@/assets/apps/pajbg.jpeg"),
  },
  jupiter: {
    slug: "jupiter",
    legacyNames: ["Jupiter"],
    capabilityIds: ["jupiter"],
    toolFunctionNames: ["swap_tokens", "check_price"],
    localIcon: require("@/assets/apps/jup.png"),
    localBanner: require("@/assets/apps/jup/jup1.webp"),
    localDescriptionImages: [
      require("@/assets/apps/jup/jup1.webp"),
      require("@/assets/apps/jup/jup2.webp"),
      require("@/assets/apps/jup/jup3.webp"),
    ],
    core: true,
  },
  heysolana: {
    slug: "heysolana",
    legacyNames: ["HeySolana", "Orova"],
    capabilityIds: ["heysolana"],
    toolFunctionNames: [
      "check_wallet_balance",
      "search_spl_tokens",
      "transfer_tokens",
    ],
    core: true,
  },
  chowdeck: {
    slug: "chowdeck",
    legacyNames: ["Chowdeck"],
    capabilityIds: ["chowdeck"],
    toolFunctionNames: [
      "set-chowdeck-location",
      "search-chowdeck-food",
      "get-chowdeck-menu-categories",
      "browse-chowdeck-vendor-menu",
      "get-chowdeck-menu-item",
      "add-chowdeck-to-cart",
      "view-chowdeck-cart",
      "clear-chowdeck-cart",
      "place-chowdeck-order",
    ],
    localIcon: require("@/assets/apps/chowdeck/icon.png"),
    localBanner: require("@/assets/apps/chowdeck/banner.png"),
    localDescriptionImages: [
      require("@/assets/apps/chowdeck/banner.png"),
    ],
  },
  jumia: {
    slug: "jumia",
    legacyNames: ["Jumia Online Shopping", "Jumia"],
    capabilityIds: ["jumia"],
    toolFunctionNames: [
      "search-jumia-products",
      "get-jumia-product-details",
      "place-jumia-order",
    ],
    localIcon: require("@/assets/apps/jumia/jumia.webp"),
    localBanner: require("@/assets/apps/jumia/banner.webp"),
  },
  kalshi: {
    slug: "kalshi",
    legacyNames: ["Kalshi Prediction Markets", "Kalshi"],
    capabilityIds: ["kalshi"],
    toolFunctionNames: [
      "activate-kalshi",
      "backup-kalshi-api-key",
      "get-kalshi-status",
      "get-kalshi-series",
      "search-kalshi-markets",
      "get-kalshi-market-details",
      "get-kalshi-odds-and-chart",
      "place-kalshi-order",
      "cancel-kalshi-order",
      "get-kalshi-orders",
      "get-kalshi-positions",
    ],
  },
  bayse: {
    slug: "bayse",
    legacyNames: ["Bayse Prediction Markets", "Bayse"],
    capabilityIds: ["bayse"],
    toolFunctionNames: [
      "activate-bayse",
      "get-bayse-status",
      "search-bayse-events",
      "get-bayse-quote",
      "place-bayse-order",
      "cancel-bayse-order",
      "get-bayse-orders",
      "get-bayse-portfolio",
      "get-bayse-activities",
    ],
  },
  magicblock: {
    slug: "magicblock",
    legacyNames: ["MagicBlock Private Payments", "MagicBlock"],
    capabilityIds: ["magicblock"],
    toolFunctionNames: [
      "private_deposit_spl",
      "private_transfer_spl",
      "private_withdraw_spl",
      "check_private_balance",
    ],
    localIcon: require("@/assets/apps/magicblock/logo.png"),
    localBanner: require("@/assets/apps/magicblock/banner.png"),
  },
};

/** Always-on tool function names (wallet core), independent of installed apps. */
export const CORE_TOOL_FUNCTION_NAMES = new Set<string>([
  "check_wallet_balance",
  "search_spl_tokens",
  "transfer_tokens",
  "swap_tokens",
  "check_price",
  "create_cross_chain_deposit_address",
  "bridge_crypto_quote",
  "check_cross_chain_deposits",
]);

export const DISPLAY_NAME_TO_SLUG: Record<string, string> = Object.values(
  APP_CAPABILITIES
).reduce((acc, capability) => {
  acc[capability.slug] = capability.slug;
  for (const legacy of capability.legacyNames) {
    acc[legacy] = capability.slug;
  }
  return acc;
}, {} as Record<string, string>);

export function resolveAppSlug(nameOrSlug?: string | null): string | null {
  if (!nameOrSlug) return null;
  return DISPLAY_NAME_TO_SLUG[nameOrSlug] ?? (/^[a-z0-9-]+$/.test(nameOrSlug) ? nameOrSlug : null);
}

export function getCapability(slugOrName?: string | null): AppCapability | null {
  const slug = resolveAppSlug(slugOrName);
  if (!slug) return null;
  return APP_CAPABILITIES[slug] ?? null;
}

export function resolveActionHandler(actionId?: string | null) {
  if (!actionId) return undefined;
  return ACTION_HANDLERS[actionId];
}

export function toImageSource(source: AppImage | null | undefined) {
  if (source == null || source === "") return undefined;
  if (typeof source === "string") return { uri: source };
  return source as ImageSource | number;
}
