import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import Convo from "@/utils/store/conversation.store";
import AppSettings from "@/utils/store/settingsstore.store";
import ChowdeckCart from "@/utils/store/chowdeck.cart.store";
import { completeConversation } from "@/utils/functions";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import {
  autocompleteChowdeckPlace,
  getChowdeckPlaceDetails,
  searchChowdeckFood,
  getChowdeckMenuCategories,
  getChowdeckVendorMenu,
  getChowdeckMenuItem,
  placeChowdeckOrder,
  markChowdeckOrderPaid,
  type ChowdeckOrderModifier,
} from "@/services/chowdeckApi";
import { getPublicSettings } from "@/services/settingsApi";
import { requestPurchaseConfirmation } from "@/services/purchaseConfirmation";
import { transferToken, getTokenBalance } from "@/libs/tools/transfer/transfers";
import { JUMIA_USDC_TREASURY } from "@/utils/constant";
import { recordCommercePaymentTransaction } from "@/services/appTransactions";
import { pajcash } from "@/libs/tools/pajcash/pajcash";
import {
  completeCommercePendingIntents,
  upsertCommercePendingIntent,
} from "@/services/commerceIntents";
import tracker from "@/utils/tracker";

const CHOWDECK_APP_NAME = "chowdeck";
const CHOWDECK_CONFIG_TYPE = "food_delivery";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;

function markChowdeckFunnelComplete() {
  void completeCommercePendingIntents({
    provider: "chowdeck",
    intent_types: ["search", "product_selected", "cart_pending", "order_pending_payment"],
  });
}

function isChowdeckActivated(): boolean {
  return ToolsItem.getState().isToolActive(CHOWDECK_APP_NAME);
}

/** Convert NGN cart total → USDC + SOL (PajCash USD/NGN + Jupiter SOL). */
async function quoteChowdeckPayment(totalNgn: number): Promise<{
  amount_usdc: number | null;
  amount_sol: number | null;
  ngn_per_usd: number | null;
}> {
  if (!Number.isFinite(totalNgn) || totalNgn <= 0) {
    return { amount_usdc: null, amount_sol: null, ngn_per_usd: null };
  }
  try {
    const rateRes = await pajcash.getUsdNgnRates();
    if (!rateRes.status) {
      return { amount_usdc: null, amount_sol: null, ngn_per_usd: null };
    }
    // Off-ramp rate: NGN per 1 USD when converting crypto → Naira (user pays USDC).
    const ngn_per_usd = rateRes.data.off_ramp_ngn_per_usd;
    if (!Number.isFinite(ngn_per_usd) || ngn_per_usd <= 0) {
      return { amount_usdc: null, amount_sol: null, ngn_per_usd: null };
    }
    const amount_usdc = Number((totalNgn / ngn_per_usd).toFixed(USDC_DECIMALS));
    const amount_sol = await quoteSolFromUsd(amount_usdc);
    return { amount_usdc, amount_sol, ngn_per_usd: Number(ngn_per_usd.toFixed(2)) };
  } catch {
    return { amount_usdc: null, amount_sol: null, ngn_per_usd: null };
  }
}

/** Derive SOL from fee-inclusive USD via Jupiter SOL price. */
async function quoteSolFromUsd(amountUsd: number): Promise<number | null> {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;
  try {
    const res = await fetch(
      `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { usdPrice?: unknown }>;
    const solUsd = Number(json?.[SOL_MINT]?.usdPrice);
    if (!Number.isFinite(solUsd) || solUsd <= 0) return null;
    return Number((amountUsd / solUsd).toFixed(6));
  } catch {
    return null;
  }
}

function persistLocationParams(place: {
  place_id: string;
  formatted_address: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const update = ToolsItem.getState().updateToolParameter;
  update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
    type: "delivery_address",
    value: place.formatted_address,
  });
  update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, { type: "place_id", value: place.place_id });
  update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
    type: "formatted_address",
    value: place.formatted_address,
  });
  if (place.latitude != null) {
    update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
      type: "latitude",
      value: String(place.latitude),
    });
  }
  if (place.longitude != null) {
    update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
      type: "longitude",
      value: String(place.longitude),
    });
  }
  ChowdeckCart.getState().setLocation({
    place_id: place.place_id,
    formatted_address: place.formatted_address,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
  });
}

function getSavedLocation(): {
  place_id: string;
  formatted_address: string;
  latitude: number | null;
  longitude: number | null;
} | null {
  const cartLoc = ChowdeckCart.getState().location;
  if (cartLoc?.place_id) {
    return {
      place_id: cartLoc.place_id,
      formatted_address: cartLoc.formatted_address,
      latitude: cartLoc.latitude ?? null,
      longitude: cartLoc.longitude ?? null,
    };
  }
  const get = (paramType: string) =>
    ToolsItem.getState().getParameterValue(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, paramType)?.trim() ??
    "";
  const place_id = get("place_id");
  const formatted_address = get("formatted_address") || get("delivery_address");
  if (!place_id || !formatted_address) return null;
  const latRaw = get("latitude");
  const lngRaw = get("longitude");
  return {
    place_id,
    formatted_address,
    latitude: latRaw ? Number(latRaw) : null,
    longitude: lngRaw ? Number(lngRaw) : null,
  };
}

export class ChowdeckTool {
  public setChowdeckLocation: FunctionParams;
  public searchChowdeckFood: FunctionParams;
  public getChowdeckMenuCategories: FunctionParams;
  public browseChowdeckVendorMenu: FunctionParams;
  public getChowdeckMenuItem: FunctionParams;
  public addChowdeckToCart: FunctionParams;
  public updateChowdeckCartQuantity: FunctionParams;
  public viewChowdeckCart: FunctionParams;
  public clearChowdeckCart: FunctionParams;
  public placeChowdeckOrder: FunctionParams;

  constructor(public session: SessionManager) {
    this.setChowdeckLocation = this.set_location();
    this.searchChowdeckFood = this.search_food();
    this.getChowdeckMenuCategories = this.menu_categories();
    this.browseChowdeckVendorMenu = this.browse_vendor_menu();
    this.getChowdeckMenuItem = this.menu_item();
    this.addChowdeckToCart = this.add_to_cart();
    this.updateChowdeckCartQuantity = this.update_cart_quantity();
    this.viewChowdeckCart = this.view_cart();
    this.clearChowdeckCart = this.clear_cart();
    this.placeChowdeckOrder = this.place_order();
  }

  set_location(): FunctionParams {
    return {
      name: "set-chowdeck-location",
      description:
        "Set or change the user's saved Chowdeck delivery address. Call only when no address is saved yet, or the user wants to change it. Pass the address text they typed; prefer street + area (not just a neighborhood name). The app shows tappable autocomplete suggestions — do not list options aloud or ask for place_id/coordinates.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description:
              "The address text the user typed (e.g. 'Mpape', 'Wuse 2 Abuja'). Required.",
          },
          place_id: {
            type: "string",
            description:
              "Optional. When the user taps a suggestion in the app, the place_id of that suggestion.",
          },
        },
        required: ["address"],
      },
      handler: async (args: { address?: string; place_id?: string }) => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated. Ask the user to activate Chowdeck in Settings → Apps, or type their delivery address here.";
        }
        const messageId = this.session.functionMessageId;
        const address = args.address?.trim();
        const tappedPlaceId = args.place_id?.trim();
        if (!address && !tappedPlaceId) {
          return {
            status: "needs_address",
            message: "Ask the user to type their delivery address or area (for example: Mpape).",
            assistant_instruction:
              "Ask them to type the address. Do not ask for place IDs or coordinates.",
          };
        }
        try {
          // User tapped a suggestion (or confirmed a known place_id) — resolve and save.
          if (tappedPlaceId) {
            const details = await getChowdeckPlaceDetails(tappedPlaceId);
            const formatted =
              details.formatted_address ||
              address ||
              details.name ||
              "Selected address";
            if (!details.place_id || !formatted) {
              if (messageId) completeConversation(messageId, "failed");
              return {
                status: "error",
                message: "Could not resolve that place. Ask them to try another address.",
              };
            }
            persistLocationParams({
              place_id: details.place_id,
              formatted_address: formatted,
              latitude: details.latitude,
              longitude: details.longitude,
            });
            if (messageId) {
              Convo.getState().updateMessage({
                messageId,
                content: {
                  content: `Delivery address saved: ${formatted}.`,
                  chowdeckAddressPicker: undefined,
                },
                source: "chowdeck",
              });
              completeConversation(messageId, "complete");
            }
            return {
              status: "success",
              delivery_address: formatted,
              message: `Delivery location set to ${formatted}. You can now search for food.`,
              assistant_instruction:
                "Confirm the address briefly, then continue with their food request if they had one. Do not mention place_id or coordinates.",
            };
          }

          const predictions = await autocompleteChowdeckPlace(address!);
          if (predictions.length === 0) {
            if (messageId) completeConversation(messageId, "failed");
            return {
              status: "no_results",
              message: `No locations found for "${address}". Ask them to try a more specific address.`,
              assistant_instruction: "Ask for a clearer area or street name. Never mention place_id.",
            };
          }

          // Single match → save immediately.
          if (predictions.length === 1) {
            const chosen = predictions[0];
            const details = await getChowdeckPlaceDetails(chosen.place_id);
            const formatted =
              details.formatted_address ||
              chosen.description ||
              chosen.structured_formatting?.main_text ||
              address!;
            if (!details.place_id || !formatted) {
              if (messageId) completeConversation(messageId, "failed");
              return {
                status: "error",
                message: "Could not resolve that place. Ask them to try another address.",
              };
            }
            persistLocationParams({
              place_id: details.place_id,
              formatted_address: formatted,
              latitude: details.latitude,
              longitude: details.longitude,
            });
            if (messageId) completeConversation(messageId, "complete");
            return {
              status: "success",
              delivery_address: formatted,
              message: `Delivery location set to ${formatted}. You can now search for food.`,
              assistant_instruction:
                "Confirm the address briefly, then continue with their food request if they had one. Do not mention place_id or coordinates.",
            };
          }

          // Multiple matches → show tappable picker on the tool card.
          // Prefer full description; Chowdeck main_text is often just the area name.
          const options = predictions.slice(0, 8).map((p) => ({
            place_id: p.place_id,
            label: p.description || p.structured_formatting?.main_text || "Address",
            description:
              p.description &&
              p.structured_formatting?.secondary_text &&
              !p.description.includes(p.structured_formatting.secondary_text)
                ? p.structured_formatting.secondary_text
                : "",
          }));
          if (messageId) {
            Convo.getState().updateMessage({
              messageId,
              content: {
                content: `Pick your delivery address for "${address}".`,
                chowdeckAddressPicker: {
                  query: address!,
                  options,
                },
              },
              source: "chowdeck",
            });
            completeConversation(messageId, "complete");
          }
          return {
            status: "needs_selection",
            address,
            message: `I found ${options.length} matching places for "${address}". The app shows tappable address options — ask the user to tap one.`,
            assistant_instruction:
              "Tell them to tap the address they want on the card. Do not list the options aloud. Do not ask for place_id. Wait for their tap before searching food.",
            displayed_in_address_picker: true,
          };
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to set location";
          if (messageId) completeConversation(messageId, "failed");
          return { status: "error", message: err };
        }
      },
    };
  }

  search_food(): FunctionParams {
    return {
      name: "search-chowdeck-food",
      description:
        "Search Chowdeck for food/dishes near the user's saved delivery address. Always uses the saved location — do not ask for an address if one is already set. If none is saved, tell the user to type an area and call set-chowdeck-location. Returns matching menu items as cards.",
      getDescription: () => {
        const loc = getSavedLocation();
        if (loc?.formatted_address) {
          return `Search Chowdeck for food/dishes near the user's saved delivery address (${loc.formatted_address}). Address is already saved — do NOT ask for location; search immediately. Only call set-chowdeck-location if the user wants to change address. Returns matching menu items as cards.`;
        }
        return "Search Chowdeck for food/dishes. No delivery address is saved yet — if this tool returns needs_location, ask the user to type an area/street and call set-chowdeck-location (app shows tap-to-pick suggestions). Returns matching menu items as cards.";
      },
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Food search query (e.g. 'fried rice', 'pizza', 'jollof')",
          },
        },
        required: ["query"],
      },
      handler: async (args: { query: string }) => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated. Ask the user to activate Chowdeck in Settings → Apps.";
        }
        const messageId = this.session.functionMessageId;
        const query = args.query?.trim() || "food";
        const location = getSavedLocation();

        if (!location) {
          return {
            status: "needs_location",
            query,
            message:
              "No delivery address saved yet. Ask the user to type their area or street, then call set-chowdeck-location with that text. Do not ask for place_id.",
            assistant_instruction:
              "Ask them to type an address/area. After they type it, call set-chowdeck-location — the app will show tap-to-pick suggestions.",
          };
        }
        try {
          const cart = ChowdeckCart.getState();
          const lockedVendor =
            cart.vendor && cart.lines.length > 0 ? cart.vendor : null;

          // Cart already has a restaurant — search THAT restaurant's full menu
          // (sides, proteins, drinks, etc.) instead of city-wide product search.
          if (lockedVendor) {
            const vendorMenu = await getChowdeckVendorMenu(lockedVendor.id, {
              query,
              returnOutOfStock: true,
            });
            const inStock = vendorMenu.items.filter((p) => p.in_stock !== false);
            const menuHits = (inStock.length > 0 ? inStock : vendorMenu.items).slice(0, 15);

            if (menuHits.length > 0) {
              const productList = menuHits.map((p) => ({
                name: `${p.name}${p.category_name ? ` — ${p.category_name}` : ""} — ${lockedVendor.name}`,
                asin: String(p.menu_id),
                menu_id: p.menu_id,
                vendor_id: lockedVendor.id,
                vendor_name: lockedVendor.name,
                price: p.price_ngn,
                base_price: p.price_ngn,
                delivery_fee: lockedVendor.delivery_price_ngn,
                minimum_order_ngn: lockedVendor.minimum_order_ngn,
                currency: "₦",
                link: "",
                image: p.image || "",
                rating: Number(p.average_rating) || 0,
                is_vendor_open: true,
              }));
              if (messageId) {
                Convo.getState().updateMessage({
                  messageId,
                  content: {
                    content: `Found ${productList.length} "${query}" item(s) on ${lockedVendor.name}'s menu (prices in Naira).`,
                  },
                  productUpdates: productList,
                  source: "chowdeck",
                });
                completeConversation(messageId, "complete");
              }
              void tracker.activity("commerce", "chowdeck_vendor_menu_search", {
                provider: "chowdeck",
                query,
                vendor_id: lockedVendor.id,
                count: productList.length,
              });
              return {
                status: "success",
                query,
                count: productList.length,
                cart_vendor: lockedVendor.name,
                same_vendor_only: true,
                from_vendor_menu: true,
                categories: vendorMenu.categories.map((c) => c.name),
                location: location.formatted_address,
                currency: "NGN",
                message: `Here are "${query}" options from ${lockedVendor.name}'s menu (your current cart restaurant). Prices in Naira. Select one to add alongside your other items.`,
                assistant_instruction: `Cart is at ${lockedVendor.name}. These are items from that restaurant's own menu (sides/proteins/drinks/etc.). Reply briefly. Do not list names or IDs — the app shows cards.`,
                displayed_in_product_card: true,
              };
            }

            // No match on this restaurant's menu — don't switch vendors silently.
            if (messageId) completeConversation(messageId, "complete");
            const categoryHint =
              vendorMenu.categories.length > 0
                ? ` Their menu sections include: ${vendorMenu.categories
                    .map((c) => c.name)
                    .slice(0, 8)
                    .join(", ")}.`
                : "";
            return {
              status: "not_on_vendor_menu",
              query,
              cart_vendor: lockedVendor.name,
              categories: vendorMenu.categories.map((c) => ({
                name: c.name,
                food_count: c.food_count,
              })),
              message: `${lockedVendor.name} doesn't currently list "${query}" on their menu.${categoryHint}`,
              assistant_instruction: `Tell the user ${lockedVendor.name} doesn't have "${query}". Offer to browse a menu section (e.g. SIDES, Proteins, Drinks) via browse-chowdeck-vendor-menu, pick something else from that restaurant, clear the cart to switch restaurants, or checkout. Never mention IDs.`,
            };
          }

          const { products } = await searchChowdeckFood(location.place_id, query);
          const inStock = products.filter((p) => p.in_stock !== false);
          const stockList = inStock.length > 0 ? inStock : products;
          const sorted = [...stockList].sort((a, b) => {
            const ao = a.is_vendor_open === false ? 1 : 0;
            const bo = b.is_vendor_open === false ? 1 : 0;
            return ao - bo;
          });

          const list = sorted.slice(0, 15);
          if (list.length === 0) {
            if (messageId) completeConversation(messageId, "complete");
            return {
              status: "no_results",
              query,
              location: location.formatted_address,
              message: `There are currently no Chowdeck vendors selling "${query}" for delivery to ${location.formatted_address}.`,
              assistant_instruction:
                "Tell the user no vendor is currently selling that dish for delivery to their saved address. Do not imply the search failed. Offer to search for another dish.",
            };
          }

          void tracker.activity("commerce", "chowdeck_search", {
            provider: "chowdeck",
            query,
            count: list.length,
            location: location.formatted_address,
          });
          void upsertCommercePendingIntent({
            provider: "chowdeck",
            intent_type: "search",
            title: "Continue your food search",
            body: `You searched for "${query}" on Chowdeck. Open HeySolana to pick a dish.`,
            metadata: { query, count: list.length, location: location.formatted_address },
            remind_after_minutes: 45,
            dedupe_key: `chowdeck:search:${location.place_id}`,
          });
          const closedCount = list.filter((p) => p.is_vendor_open === false).length;
          const productList = list.map((p) => ({
            name: `${p.name} — ${p.vendor_name}${
              p.is_vendor_open === false ? " (Closed)" : ""
            }`,
            asin: String(p.menu_id),
            menu_id: p.menu_id,
            vendor_id: p.vendor_id,
            vendor_name: p.vendor_name,
            price: p.price_ngn,
            base_price: p.price_ngn,
            delivery_fee: p.delivery_price_ngn,
            minimum_order_ngn: p.minimum_order_amount_ngn,
            currency: "₦",
            link: "",
            image: p.image || "",
            rating: Number(p.average_rating) || 0,
            is_vendor_open: p.is_vendor_open !== false,
          }));
          if (messageId) {
            Convo.getState().updateMessage({
              messageId,
              content: {
                content: `Found ${productList.length} Chowdeck dishes for "${query}" (prices in Naira).`,
              },
              productUpdates: productList,
              source: "chowdeck",
            });
            completeConversation(messageId, "complete");
          }
          return {
            status: "success",
            query,
            count: productList.length,
            closed_vendors: closedCount,
            location: location.formatted_address,
            currency: "NGN",
            message: `Here are ${query} options nearby (prices in Naira).${
              closedCount > 0
                ? ` Note: ${closedCount} of these restaurants are currently closed.`
                : ""
            } Select one from the card to see options and add it to your cart.`,
            assistant_instruction:
              "Reply briefly. Mention prices are in Naira. If any restaurants are closed, say so once. Do not list dish names, prices, or numbered options — the app shows the product cards. Never mention menu_id or vendor_id.",
            displayed_in_product_card: true,
          };
        } catch (e) {
          const err = e instanceof Error ? e.message : "Search failed";
          if (messageId) completeConversation(messageId, "failed");
          return { status: "error", query, message: `Chowdeck search failed: ${err}` };
        }
      },
    };
  }

  menu_categories(): FunctionParams {
    return {
      name: "get-chowdeck-menu-categories",
      description:
        "List menu sections for a Chowdeck restaurant (e.g. SIDES, Rice, Proteins, Drinks). Uses the cart restaurant when vendor_id is omitted. Call this to see what sections a store sells before browsing items.",
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "number",
            description: "Optional. Defaults to the restaurant already in the cart.",
          },
        },
        required: [],
      },
      handler: async (args: { vendor_id?: number }) => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated.";
        }
        const messageId = this.session.functionMessageId;
        const cartVendor = ChowdeckCart.getState().vendor;
        const vendorId = Number(args.vendor_id) || cartVendor?.id || 0;
        if (!vendorId) {
          return {
            status: "needs_vendor",
            message:
              "No restaurant selected yet. Search for food first, or pass vendor_id after the user picks a restaurant.",
          };
        }
        try {
          const categories = await getChowdeckMenuCategories(vendorId);
          const published = categories.filter((c) => c.is_published !== false);
          if (messageId) completeConversation(messageId, "complete");
          return {
            status: "success",
            vendor_id: vendorId,
            vendor_name: cartVendor?.id === vendorId ? cartVendor.name : undefined,
            categories: published.map((c) => ({
              id: c.id,
              name: c.name,
              food_count: c.food_count,
            })),
            message: `${cartVendor?.id === vendorId ? cartVendor.name : "This restaurant"} has sections: ${published
              .map((c) => `${c.name} (${c.food_count})`)
              .join(", ")}.`,
            assistant_instruction:
              "Summarize section names briefly (SIDES, Proteins, etc.). Offer to browse a section with browse-chowdeck-vendor-menu. Never invent items or mention IDs.",
          };
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to load categories";
          if (messageId) completeConversation(messageId, "failed");
          return { status: "error", message: err };
        }
      },
    };
  }

  browse_vendor_menu(): FunctionParams {
    return {
      name: "browse-chowdeck-vendor-menu",
      description:
        "Browse or filter a restaurant's full Chowdeck menu (sides, proteins, drinks, rice, etc.). Use when the cart already has a restaurant and the user wants add-ons, or when they ask what a store sells. Optional query (e.g. 'plantain', 'fanta') or category (e.g. 'SIDES', 'Proteins'). Defaults to the cart restaurant.",
      getDescription: () => {
        const cartVendor = ChowdeckCart.getState().vendor;
        if (cartVendor?.name) {
          return `Browse ${cartVendor.name}'s full Chowdeck menu (sides, proteins, drinks, etc.). Optional query or category filter. Cart restaurant is already set — do not ask for vendor_id.`;
        }
        return "Browse a restaurant's full Chowdeck menu (sides, proteins, drinks, etc.). Pass vendor_id, or use after the user has a cart restaurant. Optional query or category.";
      },
      parameters: {
        type: "object",
        properties: {
          vendor_id: {
            type: "number",
            description: "Optional. Defaults to the restaurant already in the cart.",
          },
          query: {
            type: "string",
            description: "Optional text filter (e.g. 'plantain', 'coke', 'goat meat').",
          },
          category: {
            type: "string",
            description: "Optional section name filter (e.g. 'SIDES', 'Proteins', 'Rice').",
          },
        },
        required: [],
      },
      handler: async (args: {
        vendor_id?: number;
        query?: string;
        category?: string;
      }) => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated.";
        }
        const messageId = this.session.functionMessageId;
        const cart = ChowdeckCart.getState();
        const cartVendor = cart.vendor;
        const vendorId = Number(args.vendor_id) || cartVendor?.id || 0;
        if (!vendorId) {
          return {
            status: "needs_vendor",
            message:
              "No restaurant selected yet. Search for a main dish first so we know which store's menu to browse.",
          };
        }
        if (
          cartVendor &&
          cart.lines.length > 0 &&
          Number(args.vendor_id) &&
          Number(args.vendor_id) !== cartVendor.id
        ) {
          return {
            status: "vendor_mismatch",
            cart_vendor: cartVendor.name,
            message: `Your cart is at ${cartVendor.name}. Browse that restaurant's menu, or clear the cart to switch.`,
            assistant_instruction: `Explain the cart is locked to ${cartVendor.name}. Never mention IDs.`,
          };
        }

        const vendorName = cartVendor?.id === vendorId ? cartVendor.name : `Restaurant`;
        const query = args.query?.trim() || "";
        const category = args.category?.trim() || "";

        try {
          const menu = await getChowdeckVendorMenu(vendorId, {
            query: query || undefined,
            category: category || undefined,
            returnOutOfStock: true,
          });
          const inStock = menu.items.filter((p) => p.in_stock !== false);
          const hits = (inStock.length > 0 ? inStock : menu.items).slice(0, 15);

          if (hits.length === 0) {
            if (messageId) completeConversation(messageId, "complete");
            return {
              status: "no_results",
              vendor_name: vendorName,
              query: query || null,
              category: category || null,
              categories: menu.categories,
              message: `${vendorName} has no matching items${
                query ? ` for "${query}"` : ""
              }${category ? ` in ${category}` : ""}. Sections: ${menu.categories
                .map((c) => c.name)
                .join(", ") || "none"}.`,
              assistant_instruction:
                "Offer another section or clear the filter. Do not invent items. Never mention IDs.",
            };
          }

          const productList = hits.map((p) => ({
            name: `${p.name}${p.category_name ? ` — ${p.category_name}` : ""} — ${vendorName}`,
            asin: String(p.menu_id),
            menu_id: p.menu_id,
            vendor_id: vendorId,
            vendor_name: vendorName,
            price: p.price_ngn,
            base_price: p.price_ngn,
            delivery_fee: cartVendor?.delivery_price_ngn ?? 0,
            minimum_order_ngn: cartVendor?.minimum_order_ngn ?? 0,
            currency: "₦",
            link: "",
            image: p.image || "",
            rating: Number(p.average_rating) || 0,
            is_vendor_open: true,
          }));

          if (messageId) {
            Convo.getState().updateMessage({
              messageId,
              content: {
                content: `Showing ${productList.length} item(s) from ${vendorName}'s menu (prices in Naira).`,
              },
              productUpdates: productList,
              source: "chowdeck",
            });
            completeConversation(messageId, "complete");
          }

          void tracker.activity("commerce", "chowdeck_browse_vendor_menu", {
            provider: "chowdeck",
            vendor_id: vendorId,
            query: query || null,
            category: category || null,
            count: productList.length,
          });

          return {
            status: "success",
            vendor_name: vendorName,
            query: query || null,
            category: category || null,
            count: productList.length,
            categories: menu.categories.map((c) => c.name),
            currency: "NGN",
            message: `Here are items from ${vendorName}'s menu${
              category ? ` (${category})` : ""
            }${query ? ` matching "${query}"` : ""}. Prices in Naira. Select one to add to the cart.`,
            assistant_instruction:
              "Reply briefly. These are from the restaurant's own menu (sides/proteins/drinks/etc.). Do not list every item or IDs — the app shows cards.",
            displayed_in_product_card: true,
          };
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to load menu";
          if (messageId) completeConversation(messageId, "failed");
          return { status: "error", message: err };
        }
      },
    };
  }

  menu_item(): FunctionParams {
    return {
      name: "get-chowdeck-menu-item",
      description:
        "Fetch a Chowdeck menu item with modifiers. Use after the user selects a dish from search cards (menu_id + vendor_id).",
      parameters: {
        type: "object",
        properties: {
          vendor_id: { type: "number", description: "Vendor id" },
          menu_id: { type: "number", description: "Menu item id" },
          vendor_name: { type: "string", description: "Vendor display name if known" },
          delivery_price_ngn: {
            type: "number",
            description: "Vendor delivery fee in NGN if known from search",
          },
          minimum_order_ngn: {
            type: "number",
            description: "Vendor minimum order in NGN if known from search",
          },
        },
        required: ["vendor_id", "menu_id"],
      },
      handler: async (args: {
        vendor_id: number;
        menu_id: number;
        vendor_name?: string;
        delivery_price_ngn?: number;
        minimum_order_ngn?: number;
      }) => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated.";
        }
        const messageId = this.session.functionMessageId;
        try {
          const item = await getChowdeckMenuItem(Number(args.vendor_id), Number(args.menu_id));
          let deliveryFee = Number(args.delivery_price_ngn);
          if (!Number.isFinite(deliveryFee)) {
            try {
              const settings = await getPublicSettings();
              deliveryFee = settings.delivery_fee_chowdeck_ngn ?? 0;
            } catch {
              deliveryFee = 0;
            }
          }
          const minOrder = Number(args.minimum_order_ngn) || 0;
          const cartState = ChowdeckCart.getState();
          const existingVendor = cartState.vendor;
          if (
            existingVendor &&
            existingVendor.id !== Number(args.vendor_id) &&
            cartState.lines.length > 0
          ) {
            // Keep cart intact; still show the dish details so the user can decide.
          } else {
            ChowdeckCart.getState().setVendor({
              id: Number(args.vendor_id),
              name: args.vendor_name || existingVendor?.name || "Restaurant",
              delivery_price_ngn: deliveryFee,
              minimum_order_ngn: minOrder,
            });
          }

          const details = {
            name: item.name,
            brand: args.vendor_name || "",
            price: { current: item.price_ngn, original: item.price_ngn, currency: "NGN" },
            images: item.image ? [item.image] : (item.images ?? []).map((i) => i.path),
            rating: 0,
            link: String(item.menu_id),
            url: String(item.menu_id),
            availability: item.in_stock,
            description: item.description,
            modifiers: item.modifiers,
            menu_id: item.menu_id,
            vendor_id: args.vendor_id,
            vendor_name: args.vendor_name,
            delivery_fee: deliveryFee,
            base_price: item.price_ngn,
          };

          if (messageId) {
            Convo.getState().updateProductDetails(messageId, details);
            Convo.getState().updateMessage({
              messageId,
              content: { content: `Loaded ${item.name}.` },
              source: "chowdeck",
            });
            completeConversation(messageId, "complete");
          }

          const requiredMods = (item.modifiers || []).filter((g) => g.minimum_selection > 0);
          const optionalMods = (item.modifiers || []).filter((g) => g.minimum_selection <= 0);
          const mapModGroup = (g: (typeof requiredMods)[number]) => ({
            id: g.id,
            name: g.name,
            minimum_selection: g.minimum_selection,
            maximum_selection: g.maximum_selection,
            options: g.items.map((o) => ({
              id: o.id,
              name: o.name,
              price_ngn: o.price_ngn,
            })),
          });
          return {
            status: "success",
            menu_id: item.menu_id,
            vendor_id: args.vendor_id,
            name: item.name,
            price_ngn: item.price_ngn,
            in_stock: item.in_stock,
            modifiers: item.modifiers,
            required_modifier_groups: requiredMods.map(mapModGroup),
            optional_modifier_groups: optionalMods.map(mapModGroup),
            message: requiredMods.length
              ? `${item.name} is ₦${item.price_ngn}. Required: ${requiredMods.map((g) => g.name).join(", ")}.${
                  optionalMods.length
                    ? ` Optional sides/add-ons: ${optionalMods.map((g) => g.name).join(", ")}.`
                    : ""
                }`
              : `${item.name} is ₦${item.price_ngn}.${
                  optionalMods.length
                    ? ` Optional sides/add-ons available: ${optionalMods.map((g) => g.name).join(", ")}. Ask if they want any, then add-chowdeck-to-cart.`
                    : " You can add-chowdeck-to-cart."
                }`,
            assistant_instruction:
              "Speak in plain language. Collect required choices by name first (e.g. protein, portion). Then briefly offer optional sides/add-ons this restaurant sells with the dish (meat, plantain, prawns, fish, drinks, etc.) — do not invent options not in the modifier lists. Never dump JSON or mention option IDs. Then call add-chowdeck-to-cart with selected option ids.",
            displayed_in_product_card: true,
          };
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to load menu item";
          if (messageId) completeConversation(messageId, "failed");
          return { status: "error", message: err };
        }
      },
    };
  }

  add_to_cart(): FunctionParams {
    return {
      name: "add-chowdeck-to-cart",
      description:
        "Add a Chowdeck menu item to the cart with selected modifiers. Pass quantity when they want more than 1 of a new item. To change qty on items already in the cart (e.g. '3 packs', 'make it 2'), use update-chowdeck-cart-quantity — do not clear the cart. Prices are in Naira (NGN). Default payment token is USDC; use SOL only if the user asks. Cart is single-vendor.",
      parameters: {
        type: "object",
        properties: {
          vendor_id: { type: "number" },
          vendor_name: { type: "string" },
          menu_id: { type: "number" },
          product_name: { type: "string" },
          quantity: {
            type: "number",
            description: "How many of this item to add (default 1). For changing qty of cart items already added, prefer update-chowdeck-cart-quantity.",
          },
          unit_price_ngn: {
            type: "number",
            description: "Base item price in Naira (NGN), without modifier extras",
          },
          delivery_price_ngn: { type: "number", description: "Delivery fee in Naira" },
          minimum_order_ngn: { type: "number" },
          image: { type: "string" },
          payment_token: {
            type: "string",
            enum: ["USDC", "SOL"],
            description: "Preferred payment token. Default USDC. Only set SOL if the user asks to pay with SOL.",
          },
          modifiers: {
            type: "array",
            description: "Selected modifier options",
            items: {
              type: "object",
              properties: {
                group_id: { type: "number" },
                group_name: { type: "string" },
                option_id: { type: "number" },
                option_name: { type: "string" },
                price_ngn: { type: "number" },
              },
              required: ["group_id", "option_id", "option_name", "price_ngn"],
            },
          },
        },
        required: ["vendor_id", "menu_id", "product_name", "unit_price_ngn"],
      },
      handler: async (args: {
        vendor_id: number;
        vendor_name?: string;
        menu_id: number;
        product_name: string;
        quantity?: number;
        unit_price_ngn: number;
        delivery_price_ngn?: number;
        minimum_order_ngn?: number;
        image?: string;
        payment_token?: string;
        modifiers?: ChowdeckOrderModifier[];
      }) => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated.";
        }
        const messageId = this.session.functionMessageId;
        const cart = ChowdeckCart.getState();
        const existing = cart.vendor;
        if (existing && existing.id !== Number(args.vendor_id) && cart.lines.length > 0) {
          if (messageId) completeConversation(messageId, "failed");
          return {
            status: "vendor_mismatch",
            cart_vendor: existing.name,
            message: `Your cart already has items from ${existing.name}. Chowdeck delivers from one restaurant per order. Clear the cart first, or add another item from ${existing.name}.`,
            assistant_instruction: `Explain gently that the cart is locked to ${existing.name}. Offer to clear the cart or keep adding from that restaurant. Never mention vendor_id or menu_id.`,
          };
        }
        cart.setVendor({
          id: Number(args.vendor_id),
          name: args.vendor_name || existing?.name || "Restaurant",
          delivery_price_ngn:
            Number(args.delivery_price_ngn) || existing?.delivery_price_ngn || 0,
          minimum_order_ngn:
            Number(args.minimum_order_ngn) || existing?.minimum_order_ngn || 0,
        });
        const qty = Math.max(1, Math.floor(args.quantity ?? 1));
        const result = ChowdeckCart.getState().addLine({
          menuId: Number(args.menu_id),
          name: args.product_name,
          qty,
          unitPriceNgn: Number(args.unit_price_ngn),
          modifiers: (args.modifiers ?? []).map((m) => ({
            group_id: Number(m.group_id),
            group_name: m.group_name,
            option_id: Number(m.option_id),
            option_name: m.option_name,
            price_ngn: Number(m.price_ngn) || 0,
          })),
          image: args.image,
        });
        if (!result.ok) {
          if (messageId) completeConversation(messageId, "failed");
          return { status: "error", message: result.message };
        }
        const state = ChowdeckCart.getState();
        const totalNgn = state.total();
        const quote = await quoteChowdeckPayment(totalNgn);
        const paymentToken =
          String(args.payment_token || "USDC").toUpperCase() === "SOL" ? "SOL" : "USDC";
        const optionsLabel = (args.modifiers ?? [])
          .map((m) => m.option_name)
          .filter(Boolean)
          .join(", ");

        if (messageId) {
          Convo.getState().updateMessage({
            messageId,
            content: {
              content: `Added ${args.product_name} to cart.`,
              chowdeckCartSummary: {
                product_name: args.product_name,
                vendor_name: state.vendor?.name || args.vendor_name || "Restaurant",
                quantity: qty,
                options_label: optionsLabel || undefined,
                subtotal_ngn: state.subtotal(),
                delivery_fee_ngn: state.deliveryFee(),
                total_ngn: totalNgn,
                amount_usdc: quote.amount_usdc,
                amount_sol: quote.amount_sol,
                payment_token: paymentToken,
              },
            },
            source: "chowdeck",
          });
          completeConversation(messageId, "complete");
        }

        const usdcText =
          quote.amount_usdc != null ? `${quote.amount_usdc} USDC` : "USDC (rate unavailable)";
        const solText =
          quote.amount_sol != null ? `${quote.amount_sol} SOL` : "SOL (rate unavailable)";

        void tracker.activity("commerce", "chowdeck_add_to_cart", {
          provider: "chowdeck",
          product_name: args.product_name,
          vendor_name: state.vendor?.name,
          total_ngn: totalNgn,
        });
        void upsertCommercePendingIntent({
          provider: "chowdeck",
          intent_type: "cart_pending",
          title: "Your Chowdeck cart is waiting",
          body: `${args.product_name} is in your cart (₦${totalNgn.toFixed(0)}). Open HeySolana to checkout.`,
          metadata: {
            product_name: args.product_name,
            vendor_name: state.vendor?.name,
            total_ngn: totalNgn,
            lines: state.lines.length,
          },
          remind_after_minutes: 20,
          dedupe_key: `chowdeck:cart:${state.vendor?.id ?? "unknown"}`,
        });

        return {
          status: "success",
          currency: "NGN",
          message: `Added ${args.product_name} to cart. Total ₦${totalNgn.toFixed(0)} (Naira)${
            state.meetsMinimum()
              ? ""
              : ` — need ₦${(state.vendor!.minimum_order_ngn - state.subtotal()).toFixed(0)} more for the minimum order`
          }. Expected payment: ${usdcText} (default). If they prefer SOL: about ${solText}.`,
          cart: {
            vendor_name: state.vendor?.name,
            lines: state.lines.length,
            subtotal_ngn: state.subtotal(),
            delivery_fee_ngn: state.deliveryFee(),
            total_ngn: totalNgn,
            amount_usdc: quote.amount_usdc,
            amount_sol: quote.amount_sol,
            payment_token: paymentToken,
            meets_minimum: state.meetsMinimum(),
          },
          assistant_instruction:
            "Confirm briefly that the item was added. Say the total in Naira and the expected USDC amount. Mention they can pay with SOL instead if they want. Do not read vendor_id, menu_id, or modifier IDs.",
        };
      },
    };
  }

  update_cart_quantity(): FunctionParams {
    return {
      name: "update-chowdeck-cart-quantity",
      description:
        "Change quantities on items already in the Chowdeck cart. Use for '3 packs', 'make it 2', 'I want 3 of each', or changing one item's qty. Omit product_name (or set all_items true) to set every cart line to that quantity — e.g. whole order × 3. Never clear the cart to change quantity.",
      parameters: {
        type: "object",
        properties: {
          quantity: {
            type: "number",
            description: "New quantity per updated line (minimum 1). Required.",
          },
          product_name: {
            type: "string",
            description:
              "Optional. Item name to update (partial match OK). Omit to update the whole order (all lines).",
          },
          menu_id: {
            type: "number",
            description: "Optional. Exact menu_id of the line to update.",
          },
          all_items: {
            type: "boolean",
            description:
              "If true, set quantity on every cart line (packs / whole order). Default true when product_name and menu_id are omitted.",
          },
        },
        required: ["quantity"],
      },
      handler: async (args: {
        quantity: number;
        product_name?: string;
        menu_id?: number;
        all_items?: boolean;
      }) => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated. Ask the user to activate Chowdeck in Settings → Apps.";
        }
        const messageId = this.session.functionMessageId;
        const qty = Math.max(1, Math.floor(Number(args.quantity) || 0));
        if (!Number.isFinite(qty) || qty < 1) {
          if (messageId) completeConversation(messageId, "failed");
          return { status: "error", message: "Quantity must be at least 1." };
        }

        const result = ChowdeckCart.getState().setQuantity({
          quantity: qty,
          menuId: args.menu_id != null ? Number(args.menu_id) : undefined,
          productName: args.product_name,
          allItems: args.all_items,
        });
        if (!result.ok) {
          if (messageId) completeConversation(messageId, "failed");
          return { status: "error", message: result.message };
        }

        const state = ChowdeckCart.getState();
        const totalNgn = state.total();
        const quote = await quoteChowdeckPayment(totalNgn);
        const itemLines = state.lines.map((l) => ({
          name: l.name,
          quantity: l.qty,
          line_total_ngn: l.unitPriceNgn * l.qty,
        }));
        const itemsText = itemLines
          .map((l) => `${l.quantity}× ${l.name} — ₦${l.line_total_ngn.toFixed(0)}`)
          .join("; ");

        if (messageId) {
          Convo.getState().updateMessage({
            messageId,
            content: {
              content: `Updated cart quantities. Total ₦${totalNgn.toFixed(0)}.`,
              chowdeckCartSummary: {
                product_name: `${state.lineCount()} item${state.lineCount() === 1 ? "" : "s"}`,
                vendor_name: state.vendor?.name || "Restaurant",
                quantity: state.lineCount(),
                subtotal_ngn: state.subtotal(),
                delivery_fee_ngn: state.deliveryFee(),
                total_ngn: totalNgn,
                amount_usdc: quote.amount_usdc,
                amount_sol: quote.amount_sol,
                payment_token: "USDC",
              },
            },
            source: "chowdeck",
          });
          completeConversation(messageId, "complete");
        }

        return {
          status: "success",
          currency: "NGN",
          updated_lines: result.updated,
          quantity: qty,
          vendor_name: state.vendor?.name,
          items: itemLines,
          subtotal_ngn: state.subtotal(),
          delivery_fee_ngn: state.deliveryFee(),
          total_ngn: totalNgn,
          amount_usdc: quote.amount_usdc,
          amount_sol: quote.amount_sol,
          message: `Updated quantities. Cart: ${itemsText}. Total ₦${totalNgn.toFixed(0)}${
            quote.amount_usdc != null ? ` ≈ ${quote.amount_usdc} USDC` : ""
          }.`,
          assistant_instruction:
            "Confirm the new quantities briefly with Naira total and USDC. Do not clear the cart. Do not mention IDs.",
        };
      },
    };
  }

  view_cart(): FunctionParams {
    return {
      name: "view-chowdeck-cart",
      description: "Show the current Chowdeck cart totals (Naira) and expected USDC/SOL payment amounts.",
      parameters: { type: "object", properties: {}, required: [] },
      handler: async () => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated. Ask the user to activate Chowdeck in Settings → Apps.";
        }
        const messageId = this.session.functionMessageId;
        const state = ChowdeckCart.getState();
        if (state.lines.length === 0) {
          if (messageId) completeConversation(messageId, "complete");
          return { status: "empty", message: "The Chowdeck cart is empty." };
        }
        const totalNgn = state.total();
        const quote = await quoteChowdeckPayment(totalNgn);
        const itemLines = state.lines.map((l) => ({
          name: l.name,
          quantity: l.qty,
          line_total_ngn: l.unitPriceNgn * l.qty,
          options: l.modifiers.map((m) => m.option_name).filter(Boolean),
        }));
        if (messageId) {
          Convo.getState().updateMessage({
            messageId,
            content: {
              content: `Cart total ₦${totalNgn.toFixed(0)}.`,
              chowdeckCartSummary: {
                product_name: `${state.lineCount()} item${state.lineCount() === 1 ? "" : "s"}`,
                vendor_name: state.vendor?.name || "Restaurant",
                quantity: state.lineCount(),
                subtotal_ngn: state.subtotal(),
                delivery_fee_ngn: state.deliveryFee(),
                total_ngn: totalNgn,
                amount_usdc: quote.amount_usdc,
                amount_sol: quote.amount_sol,
                payment_token: "USDC",
              },
            },
            source: "chowdeck",
          });
          completeConversation(messageId, "complete");
        }
        const itemsText = itemLines
          .map(
            (l) =>
              `${l.quantity}× ${l.name}${
                l.options.length ? ` (${l.options.join(", ")})` : ""
              } — ₦${l.line_total_ngn.toFixed(0)}`
          )
          .join("; ");
        return {
          status: "success",
          currency: "NGN",
          vendor_name: state.vendor?.name,
          location: state.location ?? getSavedLocation(),
          items: itemLines,
          lines: state.lines.length,
          subtotal_ngn: state.subtotal(),
          delivery_fee_ngn: state.deliveryFee(),
          total_ngn: totalNgn,
          amount_usdc: quote.amount_usdc,
          amount_sol: quote.amount_sol,
          meets_minimum: state.meetsMinimum(),
          minimum_order_ngn: state.vendor?.minimum_order_ngn ?? 0,
          message: `Cart at ${state.vendor?.name || "Restaurant"}: ${itemsText}. Subtotal ₦${state.subtotal().toFixed(0)}, delivery ₦${state.deliveryFee().toFixed(0)}, total ₦${totalNgn.toFixed(0)}${
            quote.amount_usdc != null ? ` ≈ ${quote.amount_usdc} USDC` : ""
          }.`,
          assistant_instruction:
            "Summarize restaurant name, each item with qty, Naira total, and USDC amount. Do not mention IDs.",
        };
      },
    };
  }

  clear_cart(): FunctionParams {
    return {
      name: "clear-chowdeck-cart",
      description:
        "Empty the Chowdeck cart (keeps delivery location). ONLY when the user explicitly wants to clear/start over or switch restaurants. NEVER use this to change quantity or 'packs' — use update-chowdeck-cart-quantity instead.",
      parameters: { type: "object", properties: {}, required: [] },
      handler: async () => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated. Ask the user to activate Chowdeck in Settings → Apps.";
        }
        const messageId = this.session.functionMessageId;
        ChowdeckCart.getState().clearLines();
        ChowdeckCart.getState().setVendor(null);
        void completeCommercePendingIntents({
          provider: "chowdeck",
          intent_types: ["cart_pending", "product_selected", "search"],
        });
        if (messageId) completeConversation(messageId, "complete");
        return { status: "success", message: "Chowdeck cart cleared." };
      },
    };
  }

  place_order(): FunctionParams {
    return {
      name: "place-chowdeck-order",
      description:
        "Place the current Chowdeck cart order after the user confirms. Cart totals are in Naira; default payment is USDC (converted via rate). Pass payment_token SOL only if the user asked to pay with SOL.",
      parameters: {
        type: "object",
        properties: {
          notes: { type: "string", description: "Optional order notes" },
          delivery_instructions: { type: "string" },
          payment_token: {
            type: "string",
            enum: ["USDC", "SOL"],
            description: "Payment token. Default USDC. Only SOL if the user asked.",
          },
        },
        required: [],
      },
      handler: async (args: {
        notes?: string;
        delivery_instructions?: string;
        payment_token?: string;
      }) => {
        const messageId = this.session.functionMessageId;
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated.";
        }
        const location = getSavedLocation();
        if (!location) {
          return "No delivery location set. Ask the user to type their address or area, then call set-chowdeck-location with that text. Do not ask for place_id.";
        }
        const cart = ChowdeckCart.getState();
        if (!cart.vendor || cart.lines.length === 0) {
          return "Cart is empty. Add items with add-chowdeck-to-cart first.";
        }
        if (!cart.meetsMinimum()) {
          return `Subtotal ₦${cart.subtotal().toFixed(0)} is below the minimum order of ₦${cart.vendor.minimum_order_ngn.toFixed(0)}. Add more items.`;
        }
        const phone = UserItem.getState().user?.mobileNumber?.trim() ?? "";
        if (!phone) {
          return "Phone number is required for delivery. Ask the user to set their phone number in their profile.";
        }
        const walletAddress = WalletItem.getState().publicKey?.toString();
        if (!walletAddress) {
          return "Wallet not available. Please connect your wallet.";
        }
        const customerName = UserItem.getState().user?.username?.trim() || "Customer";
        const payWithSol = String(args.payment_token || "USDC").toUpperCase() === "SOL";
        const previewQuote = await quoteChowdeckPayment(cart.total());

        const confirmed = await requestPurchaseConfirmation({
          productDetails: {
            name: `${cart.vendor.name} (${cart.lineCount()} items)`,
            base_price: cart.subtotal(),
            delivery_fee: cart.deliveryFee(),
            currency: "NGN",
            amount_usdc: previewQuote.amount_usdc,
            amount_sol: previewQuote.amount_sol,
            payment_token: payWithSol ? "SOL" : "USDC",
          },
          source: "chowdeck",
        });
        if (!confirmed) {
          if (messageId) completeConversation(messageId, "failed");
          return convertSpeech("Purchase cancelled.");
        }

        try {
          const result = await placeChowdeckOrder(walletAddress, {
            vendor_id: cart.vendor.id,
            vendor_name: cart.vendor.name,
            delivery: {
              place_id: location.place_id,
              formatted_address: location.formatted_address,
              latitude: location.latitude,
              longitude: location.longitude,
              phone_number: phone,
              customer_name: customerName,
            },
            delivery_fee_ngn: cart.deliveryFee(),
            items: cart.lines.map((l) => ({
              menu_id: l.menuId,
              product_name: l.name,
              quantity: l.qty,
              unit_price: l.unitPriceNgn,
              product_image_url: l.image || undefined,
              modifiers: l.modifiers,
            })),
            payment_method: payWithSol ? "sol" : "usdc",
            notes: args.notes,
            delivery_instructions: args.delivery_instructions,
          });

          const amountUsd =
            result.amount_usd != null && result.amount_usd > 0
              ? Number(Number(result.amount_usd).toFixed(USDC_DECIMALS))
              : 0;
          // SOL uses the same fee-inclusive USD as USDC (not raw NGN cart quote).
          let amountSol: number | null = null;
          if (payWithSol) {
            amountSol =
              amountUsd > 0
                ? await quoteSolFromUsd(amountUsd)
                : (await quoteChowdeckPayment(Number(result.total_amount_ngn ?? cart.total())))
                    .amount_sol;
          }
          const connection = this.session.connection;
          let treasuryAddress = "";
          if (amountUsd > 0 || (payWithSol && amountSol != null && amountSol > 0)) {
            try {
              const publicSettings = await getPublicSettings();
              treasuryAddress = publicSettings.treasury_wallet_address || JUMIA_USDC_TREASURY;
            } catch {
              treasuryAddress = JUMIA_USDC_TREASURY;
            }
          }

          if (payWithSol && amountSol != null && amountSol > 0 && treasuryAddress) {
            try {
              const balance = await getTokenBalance(
                walletAddress,
                SOL_MINT,
                SOL_DECIMALS,
                connection
              );
              if (balance < amountSol) {
                if (messageId) completeConversation(messageId, "failed");
                return convertSpeech(
                  `Order ${result.order_number} was placed but payment could not be completed. You need ${amountSol} SOL and your balance is ${balance.toFixed(4)} SOL.`
                );
              }
              const transferResult = await transferToken(
                treasuryAddress,
                SOL_MINT,
                amountSol,
                SOL_DECIMALS,
                connection
              );
              if (!transferResult.status) {
                if (messageId) completeConversation(messageId, "failed");
                return convertSpeech(
                  `Order ${result.order_number} was placed but SOL payment failed. ${
                    typeof transferResult.message === "string" ? transferResult.message : "Please try again."
                  }`
                );
              }
              const network = AppSettings.getState().networkShort;
              const txId = typeof transferResult.message === "string" ? transferResult.message : "";
              if (txId) {
                recordCommercePaymentTransaction({
                  signature: txId,
                  provider: "chowdeck",
                  app_called: CHOWDECK_APP_NAME,
                  amount: amountSol,
                  token: "SOL",
                  mint: SOL_MINT,
                  recipient: treasuryAddress,
                  order_reference: result.order_number,
                  product_reference: String(cart.vendor.id),
                  input_amount_usd: amountUsd || undefined,
                  raw_metadata: {
                    vendor_name: cart.vendor.name,
                    item_count: cart.lineCount(),
                    payment_token: "SOL",
                  },
                });
                await markChowdeckOrderPaid(walletAddress, {
                  order_number: result.order_number,
                  transaction_signature: txId,
                  payment_method: "sol",
                });
              }
              ChowdeckCart.getState().clearLines();
              markChowdeckFunnelComplete();
              if (messageId && txId) {
                completeConversation(
                  messageId,
                  "complete",
                  `https://explorer.solana.com/tx/${txId}?cluster=${network}`
                );
              } else if (messageId) {
                completeConversation(messageId, "complete");
              }
              return convertSpeech(
                `Order placed successfully. Order number: ${result.order_number}. ${amountSol} SOL has been deducted. Our team will process your food order.`
              );
            } catch (deductError) {
              if (messageId) completeConversation(messageId, "failed");
              const errMsg = deductError instanceof Error ? deductError.message : "SOL deduction failed";
              void upsertCommercePendingIntent({
                provider: "chowdeck",
                intent_type: "order_pending_payment",
                title: "Complete your Chowdeck payment",
                body: `Order ${result.order_number} needs payment. Open HeySolana to finish checkout.`,
                metadata: { order_number: result.order_number },
                remind_after_minutes: 15,
                dedupe_key: `chowdeck:order:${result.order_number}`,
              });
              return convertSpeech(
                `Order ${result.order_number} was placed but SOL deduction failed. ${errMsg}. Contact support with your order number.`
              );
            }
          }

          if (!payWithSol && amountUsd > 0 && treasuryAddress) {
            try {
              const balance = await getTokenBalance(walletAddress, USDC_MINT, USDC_DECIMALS, connection);
              if (balance < amountUsd) {
                if (messageId) completeConversation(messageId, "failed");
                return convertSpeech(
                  `Order ${result.order_number} was placed but payment could not be completed. You need ${amountUsd} USDC and your balance is ${balance.toFixed(2)} USDC.`
                );
              }
              const transferResult = await transferToken(
                treasuryAddress,
                USDC_MINT,
                amountUsd,
                USDC_DECIMALS,
                connection
              );
              if (!transferResult.status) {
                if (messageId) completeConversation(messageId, "failed");
                return convertSpeech(
                  `Order ${result.order_number} was placed but USDC payment failed. ${
                    typeof transferResult.message === "string" ? transferResult.message : "Please try again."
                  }`
                );
              }
              const network = AppSettings.getState().networkShort;
              const txId = typeof transferResult.message === "string" ? transferResult.message : "";
              if (txId) {
                recordCommercePaymentTransaction({
                  signature: txId,
                  provider: "chowdeck",
                  app_called: CHOWDECK_APP_NAME,
                  amount: amountUsd,
                  token: "USDC",
                  mint: USDC_MINT,
                  recipient: treasuryAddress,
                  order_reference: result.order_number,
                  product_reference: String(cart.vendor.id),
                  input_amount_usd: amountUsd,
                  raw_metadata: {
                    vendor_name: cart.vendor.name,
                    item_count: cart.lineCount(),
                  },
                });
                await markChowdeckOrderPaid(walletAddress, {
                  order_number: result.order_number,
                  transaction_signature: txId,
                  payment_method: "usdc",
                });
              }
              ChowdeckCart.getState().clearLines();
              markChowdeckFunnelComplete();
              if (messageId && txId) {
                completeConversation(
                  messageId,
                  "complete",
                  `https://explorer.solana.com/tx/${txId}?cluster=${network}`
                );
              } else if (messageId) {
                completeConversation(messageId, "complete");
              }
              return convertSpeech(
                `Order placed successfully. Order number: ${result.order_number}. ${amountUsd} USDC has been deducted. Our team will process your food order.`
              );
            } catch (deductError) {
              if (messageId) completeConversation(messageId, "failed");
              const errMsg = deductError instanceof Error ? deductError.message : "USDC deduction failed";
              void upsertCommercePendingIntent({
                provider: "chowdeck",
                intent_type: "order_pending_payment",
                title: "Complete your Chowdeck payment",
                body: `Order ${result.order_number} needs payment. Open HeySolana to finish checkout.`,
                metadata: { order_number: result.order_number },
                remind_after_minutes: 15,
                dedupe_key: `chowdeck:order:${result.order_number}`,
              });
              return convertSpeech(
                `Order ${result.order_number} was placed but USDC deduction failed. ${errMsg}. Contact support with your order number.`
              );
            }
          }

          ChowdeckCart.getState().clearLines();
          markChowdeckFunnelComplete();
          if (messageId) completeConversation(messageId, "complete");
          return convertSpeech(
            (amountUsd > 0 || (payWithSol && amountSol)) && !treasuryAddress
              ? `Order placed. Order number: ${result.order_number}. Payment could not be processed (treasury not configured). Contact support.`
              : `Order placed successfully. Order number: ${result.order_number}. Our team will process your food order.`
          );
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to place order";
          if (messageId) completeConversation(messageId, "failed");
          return convertSpeech(`Failed to place order. ${err}`);
        }
      },
    };
  }
}
