import type { ImageSource } from "expo-image";

export type PromoAction =
  | { type: "route"; path: string }
  | { type: "external"; url: string };

export interface PromoCampaign {
  id: string;
  enabled: boolean;
  image?: string | ImageSource;
  headline: string;
  highlight?: string;
  body?: string;
  ctaLabel?: string;
  action?: PromoAction;
}

/** Edit this object to change the in-app promo popup content. Set to null to disable. */
export const ACTIVE_PROMO: PromoCampaign | null = {
  id: "jumia-launch-2033",
  enabled: true,
  image: require("@/assets/apps/jumia/banner.webp"),
  headline: "Shop smarter with",
  highlight: "Jumia inside HeySolana",
  body: "Discover deals and pay from your wallet without leaving the app.",
  ctaLabel: "Claim Discounts",
  action: { type: "route", path: "/dashboard/jumia" },
};
