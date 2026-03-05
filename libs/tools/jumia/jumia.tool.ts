import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import Convo from "@/utils/store/conversation.store";
import { completeConversation } from "@/utils/functions";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import { searchJumiaProducts, placeJumiaOrder, type JumiaProduct, type JumiaInlineAddress } from "@/services/jumiaApi";

const JUMIA_APP_NAME = "Jumia Online Shopping";
const JUMIA_CONFIG_TYPE = "ecommerce";

function isJumiaActivated(): boolean {
  const tools = ToolsItem.getState().tools;
  const jumia = tools.find((t: any) => t.name === JUMIA_APP_NAME && t.value === "active");
  return !!jumia;
}

function getJumiaDeliveryAddress(): JumiaInlineAddress | null {
  const get = (paramType: string) =>
    ToolsItem.getState().getParameterValue(JUMIA_APP_NAME, JUMIA_CONFIG_TYPE, paramType)?.trim() ?? "";
  const full_name = get("Address Name");
  const email = get("email");
  const phone_number = get("phone_number");
  const address_line_1 = get("address_line_1");
  const city = get("city");
  const state = get("state");
  const postal_code = get("postal_code");
  const country = get("country");
  if (!full_name || !phone_number || !address_line_1 || !city || !state || !postal_code || !country) {
    return null;
  }
  return {
    full_name,
    email: email || undefined,
    phone_number,
    address_line_1,
    city,
    state,
    postal_code,
    country,
  };
}

export class JumiaTool {
  public searchJumiaProducts: FunctionParams;
  public placeJumiaOrder: FunctionParams;

  constructor(public session: SessionManager) {
    this.searchJumiaProducts = this.search_products();
    this.placeJumiaOrder = this.place_order();
  }

  search_products(): FunctionParams {
    return {
      name: "search-jumia-products",
      description:
        "Search for products on Jumia (Nigeria). Use this when the user wants to find or browse products on Jumia. Returns a list of products with name, price (NGN), and link so the user can choose one to order.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for products (e.g. 'samsung phone', 'laptop', 'shoes')",
          },
        },
        required: ["query"],
      },
      handler: async (args: { query: string }) => {
        if (!isJumiaActivated()) {
          return "Jumia is not activated. Ask the user to activate Jumia in Settings → Apps and set their delivery address and email.";
        }
        const messageId = this.session.functionMessageId;
        try {
          const products = await searchJumiaProducts(args.query, { limit: 15 });
          if (products.length === 0) {
            return convertSpeech("No products found for that search. Try a different query.");
          }
          const productList = products.map((p: JumiaProduct, i: number) => ({
            index: i + 1,
            name: p.name,
            price: p.price?.current ?? 0,
            currency: p.price?.currency ?? "NGN",
            link: p.link || p.url,
            product_id: p.link || p.url || `jumia-${i}`,
          }));
          if (messageId) {
            Convo.getState().updateMessage({
              messageId,
              productUpdates: { items: productList, source: "jumia" },
            });
            completeConversation(messageId, "complete");
          }
          const summary = productList
            .slice(0, 10)
            .map((p) => `${p.index}. ${p.name} — NGN ${Number(p.price).toLocaleString("en-NG")}`)
            .join("\n");
          return convertSpeech(
            `I found ${products.length} products. Here are the first 10:\n\n${summary}\n\nAsk the user which product they want to order (by number or name), then use place-jumia-order with that product's details.`
          );
        } catch (e) {
          const err = e instanceof Error ? e.message : "Search failed";
          if (messageId) completeConversation(messageId, "failed");
          return `Search failed: ${err}`;
        }
      },
    };
  }

  place_order(): FunctionParams {
    return {
      name: "place-jumia-order",
      description:
        "Place a Jumia order for the user. Use this after the user has chosen a product from a Jumia search. Requires product_id (or link), product_name, quantity, and unit_price in NGN. Delivery address and email are taken from the user's Jumia app settings.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "Product identifier (from search results, e.g. link or product_id)",
          },
          product_name: {
            type: "string",
            description: "Name of the product",
          },
          quantity: {
            type: "number",
            description: "Quantity to order (integer, minimum 1)",
          },
          unit_price: {
            type: "number",
            description: "Price per unit in NGN (from search results)",
          },
        },
        required: ["product_id", "product_name", "quantity", "unit_price"],
      },
      handler: async (args: { product_id: string; product_name: string; quantity: number; unit_price: number }) => {
        if (!isJumiaActivated()) {
          return "Jumia is not activated. Ask the user to activate Jumia in Settings → Apps and set their delivery address and email.";
        }
        const address = getJumiaDeliveryAddress();
        if (!address) {
          return "Delivery details are not set. Ask the user to go to Settings → Apps → Jumia Online Shopping and fill in their delivery address (name, email, phone, address, city, state, postal code, country).";
        }
        const walletAddress = WalletItem.getState().publicKey?.toString();
        if (!walletAddress) {
          return "Wallet not available. Please connect your wallet.";
        }
        try {
          const result = await placeJumiaOrder(walletAddress, {
            delivery_address: address,
            items: [
              {
                product_id: args.product_id,
                product_name: args.product_name,
                quantity: Math.max(1, Math.floor(args.quantity)),
                unit_price: Number(args.unit_price),
              },
            ],
          });
          return convertSpeech(
            `Order placed successfully. Order number: ${result.order_number}. The order will be processed by our team and you will receive updates.`
          );
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to place order";
          return `Failed to place order: ${err}`;
        }
      },
    };
  }
}
