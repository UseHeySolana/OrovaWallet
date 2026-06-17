import type { VoiceAssistantSession } from "@/libs/voiceinfra/types";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import AppSettings from "@/utils/store/settingsstore.store";
import {
  convertSpeech,
  summarizeProduct,
} from "@/utils/functions/extrafunctions";
import Convo from "@/utils/store/conversation.store";
import { completeConversation } from "@/utils/functions";
import { crossmint } from "@/libs/tools/crossmint/crossmint";
import { extractImportantInfo } from "@/utils/functions/functions";
import { BASE_URL, JUMIA_USDC_TREASURY } from "@/utils/constant";
import { getPublicSettings } from "@/services/settingsApi";
import { requestPurchaseConfirmation } from "@/services/purchaseConfirmation";
import { transferToken, getTokenBalance } from "@/libs/tools/transfer/transfers";
import { recordCommercePaymentTransaction } from "@/services/appTransactions";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

/** Build recipient from Crossmint app settings; returns null and message if invalid. */
function getCrossmintRecipient(): { recipient: { email: string; physicalAddress: Record<string, string> }; error?: string } {
  const emailParam = ToolsItem.getState().getToolParameters("Crossmint", "tracking email")[0];
  const email = emailParam?.value?.trim()?.toLowerCase();
  if (!email) {
    return { recipient: null as any, error: "Your tracking email is not set. Please set it in the app settings (Crossmint → tracking email) before placing an order." };
  }
  const params = ToolsItem.getState().getToolParameters("Crossmint", "Agentic Commerce");
  const requiredAddressFields = ["name", "line1", "city", "state", "postalCode", "country"];
  if (!params?.length) {
    return { recipient: null as any, error: "Your delivery address is not set. Please set it in the app settings (Crossmint → Agentic Commerce) before placing an order." };
  }
  const address: Record<string, string> = {
    name: "",
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  };
  for (const param of params) {
    if (param.value === "" || !String(param.value).trim()) {
      return { recipient: null as any, error: `Your ${param.type} for your delivery address is not set. Please complete your delivery address in the app settings (Crossmint → Agentic Commerce) before placing an order.` };
    }
    address[param.type as keyof typeof address] = param.value;
  }
  const missing = requiredAddressFields.filter((f) => !address[f]?.trim());
  if (missing.length > 0) {
    return { recipient: null as any, error: `Your delivery address is incomplete. Please set ${missing.join(", ")} in the app settings (Crossmint → Agentic Commerce) before placing an order.` };
  }
  return {
    recipient: { email, physicalAddress: address },
  };
}

export class Crossmint {
  public searchProductsAmazon: FunctionParams;
  public createAmazonOrder: FunctionParams;
  public productDetails: FunctionParams;

  constructor(public session: VoiceAssistantSession) {
    this.createAmazonOrder = this.create_order();
    this.searchProductsAmazon = this.search_product();
    this.productDetails = this.product_details();
  }

  create_order() {
    return {
      name: "create-order",
      description: "This function is used to create an order on amazon",
      parameters: {
        type: "object",
        properties: {
          asin: {
            type: "string",
            description:
              "This is the asin of the product you want to purchase, it should be a string",
          },
        },
        required: ["asin"],
      },

      handler: async (args: { asin: string }) => {
        const messageId = this.session.functionMessageId;
        const walletAddress = WalletItem.getState().publicKey?.toString() ?? "";
        if (!walletAddress) {
          if (messageId) completeConversation(messageId, "failed");
          return convertSpeech("Wallet not available. Please connect your wallet.");
        }

        const { recipient, error: recipientError } = getCrossmintRecipient();
        if (recipientError) {
          if (messageId) completeConversation(messageId, "failed");
          return convertSpeech(recipientError);
        }

        const confirmed = await requestPurchaseConfirmation({
          productDetails: {
            name: `Product (ASIN: ${args.asin})`,
            base_price: 0,
            delivery_fee: 0,
            currency: "USD",
          },
          source: "crossmint",
        });
        if (!confirmed) {
          if (messageId) completeConversation(messageId, "failed");
          return "Order cancelled.";
        }

        if (!BASE_URL) {
          if (messageId) completeConversation(messageId, "failed");
          return convertSpeech("Order service is not configured. Please try again later.");
        }

        let orderNumber: string;
        let amountUsd: number;

        try {
          const createRes = await fetch(`${BASE_URL}/crossmint/wallet/orders/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet_address: walletAddress,
              asin: args.asin,
              recipient,
            }),
          });
          const createData = await createRes.json().catch(() => ({}));
          if (!createRes.ok || !createData.success) {
            if (messageId) completeConversation(messageId, "failed");
            return convertSpeech(createData.message || "Failed to create order. Please try again.");
          }
          orderNumber = createData.data?.order_number ?? "";
          amountUsd = createData.data?.amount_usd != null && createData.data.amount_usd > 0
            ? Number(Number(createData.data.amount_usd).toFixed(USDC_DECIMALS))
            : 0;
        } catch (e) {
          if (messageId) completeConversation(messageId, "failed");
          return convertSpeech("Failed to create order. Please try again.");
        }

        if (amountUsd > 0) {
          let treasuryAddress = "";
          try {
            const publicSettings = await getPublicSettings();
            // Treasury is set by admin in the backend; fallback to env only if API fails
            treasuryAddress = publicSettings.treasury_wallet_address || JUMIA_USDC_TREASURY;
          } catch {
            treasuryAddress = JUMIA_USDC_TREASURY;
          }
          if (!treasuryAddress) {
            if (messageId) completeConversation(messageId, "complete");
            return convertSpeech(
              `Order ${orderNumber} was created but payment could not be processed (treasury not configured). Please contact support.`
            );
          }
          try {
            const connection = this.session.connection;
            const balance = await getTokenBalance(walletAddress, USDC_MINT, USDC_DECIMALS, connection);
            if (balance < amountUsd) {
              if (messageId) completeConversation(messageId, "failed");
              return convertSpeech(
                `Order ${orderNumber} was created but payment could not be completed. You need ${amountUsd} USDC and your balance is ${balance.toFixed(2)} USDC. Please add USDC and try again or contact support.`
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
                `Order ${orderNumber} was created but USDC payment failed. ${typeof transferResult.message === "string" ? transferResult.message : "Please try again or contact support."}`
              );
            }
            const network = AppSettings.getState().networkShort;
            const txId = typeof transferResult.message === "string" ? transferResult.message : "";
            if (txId) {
              recordCommercePaymentTransaction({
                signature: txId,
                provider: "crossmint",
                app_called: "Crossmint",
                amount: amountUsd,
                token: "USDC",
                mint: USDC_MINT,
                recipient: treasuryAddress,
                order_reference: orderNumber,
                product_reference: args.asin,
                input_amount_usd: amountUsd,
              });
            }
            if (messageId && txId) {
              completeConversation(messageId, "complete", `https://explorer.solana.com/tx/${txId}?cluster=${network}`);
            } else if (messageId) {
              completeConversation(messageId, "complete");
            }
            return convertSpeech(
              `Order created successfully. Order number: ${orderNumber}. ${amountUsd} USDC has been deducted from your wallet. You will receive updates on your order.`
            );
          } catch (deductError) {
            if (messageId) completeConversation(messageId, "failed");
            const errMsg = deductError instanceof Error ? deductError.message : "USDC deduction failed";
            return convertSpeech(
              `Order ${orderNumber} was created but payment failed. ${errMsg}. Please contact support with your order number.`
            );
          }
        }

        if (messageId) completeConversation(messageId, "complete");
        return convertSpeech(`Order created successfully. Order number: ${orderNumber}. You will receive updates on your order.`);
      },
    };
  }

  /**
   *
   * @returns
   */
  search_product() {
    return {
      name: "search-products-amazon",
      description: "This function is used to search for products on amazon",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "This is the name of the product you want to search for, it should be a string",
          },
        },
        required: ["name"],
      },

      handler: async (args: { name: string }) => {
        const messageId = this.session.functionMessageId;
        if (!messageId) return "No message id found";
        const response = await crossmint.search.amazon.search(args.name);
        const items = response.data.results;
        let deliveryFeeUsd = 0;
        try {
          const publicSettings = await getPublicSettings();
          deliveryFeeUsd = publicSettings.delivery_fee_crossmint_usd ?? 0;
        } catch {
          // use 0 if settings fail
        }
        const products = items.map((item: any) => {
          const basePrice = typeof item.price === "number" ? item.price : Number(item.price) || 0;
          const totalPrice = basePrice + deliveryFeeUsd;
          return {
            name: item.name,
            asin: item.asin,
            price: totalPrice,
            base_price: basePrice,
            delivery_fee: deliveryFeeUsd,
            currency: item.price_symbol ?? "USD",
            image: item.image,
            link: item.url,
            rating: item.stars,
          };
        });

        Convo.getState().updateMessage({
          messageId: messageId,
          productUpdates: products,
          source: "crossmint",
        });

        completeConversation(messageId, "complete");

        return convertSpeech(
          `Kindly choose which of the products you want to purchase from. products: ${JSON.stringify(products)}`
        );
      },
    };
  }
  product_details() {
    return {
      name: "product-details",
      description:
        "This function is used to get the details of a product and give short summary of the product if it is a great product",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description:
              "This is the product id you want to get the details of, it should be a string",
          },
        },
        required: ["product_id"],
      },
      handler: async (args: { product_id: string }) => {
        const messageId = this.session.functionMessageId;
        if (!messageId) return "No message id found";
        const response = await crossmint.search.amazon.get(args.product_id);
        const items = response.data;

        const product = items;

        const productInfo = extractImportantInfo(product);
        let deliveryFeeUsd = 0;
        try {
          const publicSettings = await getPublicSettings();
          deliveryFeeUsd = publicSettings.delivery_fee_crossmint_usd ?? 0;
        } catch {
          // use 0 if settings fail
        }
        const rawPrice = productInfo.price;
        const basePrice =
          typeof rawPrice === "number" && !Number.isNaN(rawPrice)
            ? rawPrice
            : typeof rawPrice === "string"
              ? parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0
              : Number(rawPrice) || 0;
        const totalPrice = basePrice + deliveryFeeUsd;

        Convo.getState().updateProductDetails(messageId, {
          name: productInfo.name,
          brand: productInfo.brand,
          price: totalPrice,
          base_price: basePrice,
          delivery_fee: deliveryFeeUsd,
          currency: "USD",
          rating: productInfo.rating,
          reviews: productInfo.reviews,
          topReview: productInfo.topReview,
          images: productInfo.images,
          colors: productInfo.colors,
          sizes: productInfo.sizes,
          category: productInfo.category,
          asin: productInfo.asin,
          dimensions: productInfo.dimensions,
          availableSince: productInfo.availableSince,
          bestSellerRank: productInfo.bestSellerRank,
        });

        const summary = await summarizeProduct(JSON.stringify(product));
        completeConversation(messageId, "complete");
        return summary;
      },
    };
  }
}
