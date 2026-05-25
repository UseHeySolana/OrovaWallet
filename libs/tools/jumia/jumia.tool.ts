import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import Convo from "@/utils/store/conversation.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { completeConversation } from "@/utils/functions";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import { searchJumiaProducts, placeJumiaOrder, getJumiaProductDetails, type JumiaProduct, type JumiaInlineAddress } from "@/services/jumiaApi";
import { getPublicSettings } from "@/services/settingsApi";
import { requestPurchaseConfirmation } from "@/services/purchaseConfirmation";
import { transferToken, getTokenBalance } from "@/libs/tools/transfer/transfers";
import { JUMIA_USDC_TREASURY } from "@/utils/constant";
import { recordCommercePaymentTransaction } from "@/services/appTransactions";

const JUMIA_APP_NAME = "Jumia Online Shopping";
const JUMIA_CONFIG_TYPE = "ecommerce";
/** USDC mint (mainnet/devnet) */
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

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
  const phone_number = UserItem.getState().user?.mobileNumber?.trim() ?? "";
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
  public getJumiaProductDetails: FunctionParams;

  constructor(public session: SessionManager) {
    this.searchJumiaProducts = this.search_products();
    this.placeJumiaOrder = this.place_order();
    this.getJumiaProductDetails = this.jumia_product_details();
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
          let deliveryFeeNgn = 0;
          try {
            const publicSettings = await getPublicSettings();
            deliveryFeeNgn = publicSettings.delivery_fee_jumia_ngn ?? 0;
          } catch {
            // use 0 if settings fail
          }
          const productList = products.map((p: JumiaProduct) => {
            const basePrice = p.price?.current ?? 0;
            const totalPrice = basePrice + deliveryFeeNgn;
            return {
              name: p.name,
              asin: p.url || "",
              price: totalPrice,
              base_price: basePrice,
              delivery_fee: deliveryFeeNgn,
              currency: p.price?.currency ?? "NGN",
              link: p.link || "",
              image: p.image || "",
              rating: p.rating || 0,
            };
          });
          if (messageId) {
            Convo.getState().updateMessage({
              messageId,
              productUpdates: productList,
              source: "jumia",
            });
            completeConversation(messageId, "complete");
          }
          return convertSpeech(
            `Kindly choose which of the products you want to purchase from. products: ${JSON.stringify(productList)}`
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
        const messageId = this.session.functionMessageId;
        if (!isJumiaActivated()) {
          return "Jumia is not activated. Ask the user to activate Jumia in Settings → Apps and set their delivery address and email.";
        }
        const address = getJumiaDeliveryAddress();
        if (!address) {
          return "Delivery details are not set. Ask the user to go to Settings → Apps → Jumia Online Shopping and fill in their delivery address (name, email, address, city, state, postal code, country). Ensure their phone number is set in their profile.";
        }
        const walletAddress = WalletItem.getState().publicKey?.toString();
        if (!walletAddress) {
          return "Wallet not available. Please connect your wallet.";
        }
        let deliveryFeeNgn = 0;
        try {
          const publicSettings = await getPublicSettings();
          deliveryFeeNgn = publicSettings.delivery_fee_jumia_ngn ?? 0;
        } catch {
          // use 0 if settings fail
        }
        const basePrice = Number(args.unit_price) * Math.max(1, Math.floor(args.quantity));
        const confirmed = await requestPurchaseConfirmation({
          productDetails: {
            name: args.product_name,
            base_price: basePrice,
            delivery_fee: deliveryFeeNgn,
            currency: "NGN",
          },
          source: "jumia",
        });
        if (!confirmed) {
          if (messageId) completeConversation(messageId, "failed");
          return convertSpeech("Purchase cancelled.");
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

          const amountUsd = result.amount_usd != null && result.amount_usd > 0 ? Number(Number(result.amount_usd).toFixed(USDC_DECIMALS)) : 0;
          const connection = this.session.connection;
          let treasuryAddress = "";
          if (amountUsd > 0) {
            try {
              const publicSettings = await getPublicSettings();
              // Treasury is set by admin in the backend; fallback to env only if API fails
              treasuryAddress = publicSettings.treasury_wallet_address || JUMIA_USDC_TREASURY;
            } catch {
              treasuryAddress = JUMIA_USDC_TREASURY;
            }
          }

          if (amountUsd > 0 && treasuryAddress) {
            try {
              const balance = await getTokenBalance(walletAddress, USDC_MINT, USDC_DECIMALS, connection);
              if (balance < amountUsd) {
                if (messageId) completeConversation(messageId, "failed");
                return convertSpeech(
                  `Order ${result.order_number} was placed but payment could not be completed. You need ${amountUsd} USDC and your balance is ${balance.toFixed(2)} USDC. Please add USDC and try again or contact support.`
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
                  `Order ${result.order_number} was placed but USDC payment failed. ${typeof transferResult.message === "string" ? transferResult.message : "Please try again or contact support."}`
                );
              }
              const network = AppSettings.getState().networkShort;
              const txId = typeof transferResult.message === "string" ? transferResult.message : "";
              if (txId) {
                recordCommercePaymentTransaction({
                  signature: txId,
                  provider: "jumia",
                  app_called: JUMIA_APP_NAME,
                  amount: amountUsd,
                  token: "USDC",
                  mint: USDC_MINT,
                  recipient: treasuryAddress,
                  order_reference: result.order_number,
                  product_reference: args.product_id,
                  input_amount_usd: amountUsd,
                  raw_metadata: {
                    product_name: args.product_name,
                    quantity: Math.max(1, Math.floor(args.quantity)),
                  },
                });
              }
              if (messageId && txId) {
                completeConversation(messageId, "complete", `https://explorer.solana.com/tx/${txId}?cluster=${network}`);
              } else if (messageId) {
                completeConversation(messageId, "complete");
              }
              return convertSpeech(
                `Order placed successfully. Order number: ${result.order_number}. ${amountUsd} USDC has been deducted from your wallet. The order will be processed by our team and you will receive updates.`
              );
            } catch (deductError) {
              if (messageId) completeConversation(messageId, "failed");
              const errMsg = deductError instanceof Error ? deductError.message : "USDC deduction failed";
              return convertSpeech(
                `Order ${result.order_number} was placed but USDC deduction failed. ${errMsg}. Please contact support with your order number.`
              );
            }
          }

          if (messageId) completeConversation(messageId, "complete");
          return convertSpeech(
            amountUsd > 0 && !treasuryAddress
              ? `Order placed successfully. Order number: ${result.order_number}. Payment of ${amountUsd} USDC could not be processed (treasury not configured). Please contact support.`
              : `Order placed successfully. Order number: ${result.order_number}. The order will be processed by our team and you will receive updates.`
          );
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to place order";
          if (messageId) completeConversation(messageId, "failed");
          return convertSpeech(`Failed to place order. ${err}`);
        }
      },
    };
  }

  /**
   * Get Jumia product details and show in UI. Use when user selected a Jumia product
   * or asked to fetch details from Jumia (not Amazon/Crossmint).
   */
  jumia_product_details(): FunctionParams {
    return {
      name: "get-jumia-product-details",
      description:
        "Get full details of a product from Jumia. Use this when the user selected a Jumia product or asked to fetch details from Jumia (not Amazon). Requires the product link/URL from the Jumia search results.",
      parameters: {
        type: "object",
        properties: {
          product_link: {
            type: "string",
            description: "The Jumia product URL or link from search results",
          },
        },
        required: ["product_link"],
      },
      handler: async (args: { product_link: string }) => {
        const messageId = this.session.functionMessageId;
        if (!messageId) return "No message id found";
        try {
          const details = await getJumiaProductDetails(args.product_link);
          const priceNum =
            typeof details.price === "object" && details.price?.current != null
              ? details.price.current
              : Number(details.price) || 0;
          const currency =
            typeof details.price === "object" && details.price?.currency
              ? details.price.currency
              : "NGN";
          let deliveryFeeNgn = 0;
          try {
            const publicSettings = await getPublicSettings();
            deliveryFeeNgn = publicSettings.delivery_fee_jumia_ngn ?? 0;
          } catch {
            // use 0 if settings fail
          }
          const totalPrice = priceNum + deliveryFeeNgn;
          const link = details.link ?? details.url ?? args.product_link;
          Convo.getState().updateProductDetails(messageId, {
            name: details.name,
            brand: details.brand,
            price: totalPrice,
            base_price: priceNum,
            delivery_fee: deliveryFeeNgn,
            currency,
            rating: details.rating ?? 0,
            images: details.images ?? [],
            asin: link,
            link,
            url: details.url ?? link,
          });
          Convo.getState().updateMessage({ messageId, source: "jumia" });
          completeConversation(messageId, "complete");
          return convertSpeech(
            "Here are the product details. You can purchase this item when ready."
          );
        } catch (e) {
          const err = e instanceof Error ? e.message : "Failed to load product details";
          if (messageId) completeConversation(messageId, "failed");
          return `Failed to get product details: ${err}`;
        }
      },
    };
  }
}
