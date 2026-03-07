import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import {
  convertSpeech,
  summarizeProduct,
} from "@/utils/functions/extrafunctions";
import Convo from "@/utils/store/conversation.store";
import { completeConversation } from "@/utils/functions";
import { crossmint } from "@/libs/tools/crossmint/crossmint";
import { extractImportantInfo } from "@/utils/functions/functions";
import { BASE_URL } from "@/utils/constant";
import { getPublicSettings } from "@/services/settingsApi";

export class Crossmint {
  public searchProductsAmazon: FunctionParams;
  public createAmazonOrder: FunctionParams;
  public productDetails: FunctionParams;

  constructor(public session: SessionManager) {
    this.createAmazonOrder = this.create_order();
    this.searchProductsAmazon = this.search_product();
    this.productDetails = this.product_details();
  }

  create_order() {
    return {
      name: "create--order",
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
        const payerAddress = WalletItem.getState().publicKey?.toString() ?? "";
        const response = await crossmint.orders.createOrder({
          asin: args.asin,
          payerAddress,
        });

        if (!response.status) return response.message;

        if (BASE_URL && payerAddress) {
          try {
            const data = response.data as Record<string, unknown> | undefined;
            const createOrderResponse = response as {
              recipient?: { email?: string; physicalAddress?: Record<string, string> };
            };
            // Recipient is returned by createOrder (our code), or may be echoed in API response
            const recipient =
              createOrderResponse.recipient ??
              (data?.recipient as { email?: string; physicalAddress?: Record<string, string> } | undefined);

            const totalRaw =
              data?.totalAmount ??
              data?.amount ??
              data?.total ??
              (data?.cost as Record<string, unknown>)?.total ??
              (data as Record<string, unknown>)?.orderTotal;
            const totalNum =
              totalRaw != null
                ? typeof totalRaw === "number"
                  ? totalRaw
                  : typeof totalRaw === "string"
                    ? parseFloat(totalRaw)
                    : null
                : null;
            const totalAmount =
              totalNum != null && !Number.isNaN(totalNum) ? totalNum : null;
            const currency =
              (data?.currency as string) ??
              (data?.currencyCode as string) ??
              "USD";

            const body = {
              wallet_address: payerAddress,
              crossmint_order_id:
                (data?.id as string) ??
                (data?.orderId as string) ??
                (data?.order_id as string) ??
                null,
              asin: args.asin,
              total_amount: totalAmount,
              currency,
              raw_response: data ?? null,
              recipient_email: recipient?.email ?? null,
              recipient: recipient
                ? {
                    email: recipient.email ?? null,
                    physicalAddress: recipient.physicalAddress ?? null,
                  }
                : null,
            };

            await fetch(`${BASE_URL}/crossmint/wallet/orders`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
          } catch (_) {
            // non-blocking: order already created on Crossmint
          }
        }

        return response.message;

        // const   confirmation = await this.session.connection.confirmTransaction(
        //     transfer.message,
        //     "confirmed"
        //   );

        // if (confirmation) {
        //   return `You have successfully Paj ${args.amount} ${args.token} to Naira`;
        // } else {
        //   return `Failed to Paj ${args.amount} ${args.token} to Naira`;
        // }
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
