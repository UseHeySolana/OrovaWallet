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
  getChowdeckMenuItem,
  placeChowdeckOrder,
  type ChowdeckOrderModifier,
} from "@/services/chowdeckApi";
import { getPublicSettings } from "@/services/settingsApi";
import { requestPurchaseConfirmation } from "@/services/purchaseConfirmation";
import { transferToken, getTokenBalance } from "@/libs/tools/transfer/transfers";
import { JUMIA_USDC_TREASURY } from "@/utils/constant";
import { recordCommercePaymentTransaction } from "@/services/appTransactions";
import { pajcash } from "@/libs/tools/pajcash/pajcash";

const CHOWDECK_APP_NAME = "chowdeck";
const CHOWDECK_CONFIG_TYPE = "food_delivery";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;

function isChowdeckActivated(): boolean {
  return ToolsItem.getState().isToolActive(CHOWDECK_APP_NAME);
}

/** Convert NGN cart total → USDC + SOL via PajCash public rate (no separate tool call). */
async function quoteChowdeckPayment(totalNgn: number): Promise<{
  amount_usdc: number | null;
  amount_sol: number | null;
  ngn_per_usd: number | null;
}> {
  if (!Number.isFinite(totalNgn) || totalNgn <= 0) {
    return { amount_usdc: null, amount_sol: null, ngn_per_usd: null };
  }
  try {
    const rateRes = await pajcash.getNairaRate(1);
    if (!rateRes.status) {
      return { amount_usdc: null, amount_sol: null, ngn_per_usd: null };
    }
    const fiatForOneSol = Number(rateRes.data.amounts.userAmountFiat) || 0;
    const usdForOneSol = Number(rateRes.data.amounts.amountUSD) || 0;
    if (fiatForOneSol <= 0) {
      return { amount_usdc: null, amount_sol: null, ngn_per_usd: null };
    }
    const amount_sol = Number((totalNgn / fiatForOneSol).toFixed(6));
    const ngn_per_usd =
      usdForOneSol > 0 ? Number((fiatForOneSol / usdForOneSol).toFixed(2)) : null;
    const amount_usdc =
      usdForOneSol > 0
        ? Number(((totalNgn * usdForOneSol) / fiatForOneSol).toFixed(USDC_DECIMALS))
        : null;
    return { amount_usdc, amount_sol, ngn_per_usd };
  } catch {
    return { amount_usdc: null, amount_sol: null, ngn_per_usd: null };
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
  public getChowdeckMenuItem: FunctionParams;
  public addChowdeckToCart: FunctionParams;
  public viewChowdeckCart: FunctionParams;
  public clearChowdeckCart: FunctionParams;
  public placeChowdeckOrder: FunctionParams;

  constructor(public session: SessionManager) {
    this.setChowdeckLocation = this.set_location();
    this.searchChowdeckFood = this.search_food();
    this.getChowdeckMenuCategories = this.menu_categories();
    this.getChowdeckMenuItem = this.menu_item();
    this.addChowdeckToCart = this.add_to_cart();
    this.viewChowdeckCart = this.view_cart();
    this.clearChowdeckCart = this.clear_cart();
    this.placeChowdeckOrder = this.place_order();
  }

  set_location(): FunctionParams {
    return {
      name: "set-chowdeck-location",
      description:
        "Set or change the user's saved Chowdeck delivery address. Call only when no address is saved yet, or the user wants to change it. Pass the address text they typed; the app shows tappable autocomplete suggestions — do not list options aloud or ask for place_id/coordinates.",
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
          const options = predictions.slice(0, 8).map((p) => ({
            place_id: p.place_id,
            label:
              p.structured_formatting?.main_text ||
              p.description ||
              "Address",
            description:
              p.structured_formatting?.secondary_text ||
              (p.description !== p.structured_formatting?.main_text ? p.description : "") ||
              "",
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
          const { products } = await searchChowdeckFood(location.place_id, query);
          const inStock = products.filter((p) => p.in_stock !== false);
          const stockList = inStock.length > 0 ? inStock : products;
          // Prefer open vendors first; still include closed ones with a clear label.
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
              "Reply briefly. Mention prices are in Naira. If any restaurants are closed, say so once. Do not list dish names, prices, or numbered options — the app shows the product cards.",
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
        "Get menu categories for a Chowdeck vendor after the user picks a restaurant. Use for orientation; prefer search-chowdeck-food for finding dishes.",
      parameters: {
        type: "object",
        properties: {
          vendor_id: { type: "number", description: "Chowdeck vendor id" },
        },
        required: ["vendor_id"],
      },
      handler: async (args: { vendor_id: number }) => {
        if (!isChowdeckActivated()) {
          return "Chowdeck is not activated.";
        }
        const messageId = this.session.functionMessageId;
        try {
          const categories = await getChowdeckMenuCategories(Number(args.vendor_id));
          if (messageId) completeConversation(messageId, "complete");
          return {
            status: "success",
            vendor_id: args.vendor_id,
            categories: categories.map((c) => ({
              id: c.id,
              name: c.name,
              food_count: c.food_count,
            })),
            message: `This restaurant has ${categories.length} menu categories. Ask what dish they want, then search or fetch a menu item.`,
            assistant_instruction: "Summarize category names briefly; do not invent menu items.",
          };
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to load categories";
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
          ChowdeckCart.getState().setVendor({
            id: Number(args.vendor_id),
            name: args.vendor_name || `Vendor ${args.vendor_id}`,
            delivery_price_ngn: deliveryFee,
            minimum_order_ngn: minOrder,
          });

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
          return {
            status: "success",
            menu_id: item.menu_id,
            vendor_id: args.vendor_id,
            name: item.name,
            price_ngn: item.price_ngn,
            in_stock: item.in_stock,
            modifiers: item.modifiers,
            required_modifier_groups: requiredMods.map((g) => ({
              id: g.id,
              name: g.name,
              minimum_selection: g.minimum_selection,
              maximum_selection: g.maximum_selection,
              options: g.items.map((o) => ({
                id: o.id,
                name: o.name,
                price_ngn: o.price_ngn,
              })),
            })),
            message: requiredMods.length
              ? `${item.name} is ₦${item.price_ngn}. Ask for required options, then add-chowdeck-to-cart.`
              : `${item.name} is ₦${item.price_ngn}. You can add-chowdeck-to-cart.`,
            assistant_instruction:
              "Do not dump the full modifier JSON. Ask only for required choices by name, then call add-chowdeck-to-cart with the selected option ids.",
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
        "Add a Chowdeck menu item to the cart with selected modifiers. Prices are in Naira (NGN). After adding, the app shows a payment summary in Naira and USDC (PajCash rate). Default payment token is USDC; use SOL only if the user asks. Cart is single-vendor.",
      parameters: {
        type: "object",
        properties: {
          vendor_id: { type: "number" },
          vendor_name: { type: "string" },
          menu_id: { type: "number" },
          product_name: { type: "string" },
          quantity: { type: "number" },
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
            message:
              "Cart already has items from another restaurant. Clear the cart first with clear-chowdeck-cart, or finish that order.",
          };
        }
        cart.setVendor({
          id: Number(args.vendor_id),
          name: args.vendor_name || existing?.name || `Vendor ${args.vendor_id}`,
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

  view_cart(): FunctionParams {
    return {
      name: "view-chowdeck-cart",
      description: "Show the current Chowdeck cart totals (Naira) and expected USDC/SOL payment amounts.",
      parameters: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const messageId = this.session.functionMessageId;
        const state = ChowdeckCart.getState();
        if (state.lines.length === 0) {
          if (messageId) completeConversation(messageId, "complete");
          return { status: "empty", message: "The Chowdeck cart is empty." };
        }
        const totalNgn = state.total();
        const quote = await quoteChowdeckPayment(totalNgn);
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
        return {
          status: "success",
          currency: "NGN",
          vendor_name: state.vendor?.name,
          location: state.location ?? getSavedLocation(),
          lines: state.lines.length,
          subtotal_ngn: state.subtotal(),
          delivery_fee_ngn: state.deliveryFee(),
          total_ngn: totalNgn,
          amount_usdc: quote.amount_usdc,
          amount_sol: quote.amount_sol,
          meets_minimum: state.meetsMinimum(),
          minimum_order_ngn: state.vendor?.minimum_order_ngn ?? 0,
          message: `Cart at ${state.vendor?.name}: ${state.lineCount()} items, total ₦${totalNgn.toFixed(0)} (Naira)${
            quote.amount_usdc != null ? ` ≈ ${quote.amount_usdc} USDC` : ""
          }.`,
          assistant_instruction:
            "Summarize item count, Naira total, and USDC amount only. Mention SOL only if they ask. Do not read every line aloud.",
        };
      },
    };
  }

  clear_cart(): FunctionParams {
    return {
      name: "clear-chowdeck-cart",
      description: "Clear Chowdeck cart line items (keeps delivery location).",
      parameters: { type: "object", properties: {}, required: [] },
      handler: async () => {
        const messageId = this.session.functionMessageId;
        ChowdeckCart.getState().clearLines();
        ChowdeckCart.getState().setVendor(null);
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

        const confirmed = await requestPurchaseConfirmation({
          productDetails: {
            name: `${cart.vendor.name} (${cart.lineCount()} items)`,
            base_price: cart.subtotal(),
            delivery_fee: cart.deliveryFee(),
            currency: "NGN",
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
            payment_method:
              String(args.payment_token || "USDC").toUpperCase() === "SOL" ? "sol" : "usdc",
            notes: args.notes,
            delivery_instructions: args.delivery_instructions,
          });

          const payWithSol = String(args.payment_token || "USDC").toUpperCase() === "SOL";
          const amountUsd =
            result.amount_usd != null && result.amount_usd > 0
              ? Number(Number(result.amount_usd).toFixed(USDC_DECIMALS))
              : 0;
          let amountSol: number | null = null;
          if (payWithSol) {
            const quote = await quoteChowdeckPayment(
              Number(result.total_amount_ngn ?? cart.total())
            );
            amountSol = quote.amount_sol;
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
              }
              ChowdeckCart.getState().clearLines();
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
              }
              ChowdeckCart.getState().clearLines();
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
              return convertSpeech(
                `Order ${result.order_number} was placed but USDC deduction failed. ${errMsg}. Contact support with your order number.`
              );
            }
          }

          ChowdeckCart.getState().clearLines();
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
