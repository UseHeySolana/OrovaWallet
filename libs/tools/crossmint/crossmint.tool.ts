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
        const response = await crossmint.orders.createOrder({
          asin: args.asin,
          payerAddress: WalletItem.getState().publicKey?.toString() ?? "",
        });

        if (!response.status) return response.message;

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

        const products = items.map((item: any) => ({
          name: item.name,
          asin: item.asin,
          price: item.price,
          currency: item.price_symbol,
          image: item.image,
          link: item.url,
          rating: item.stars,
        }));

        Convo.getState().updateMessage({
          messageId: messageId,
          productUpdates: products,
        });

        completeConversation(messageId, "complete");

        return convertSpeech(
          `Kindly choose which of the products you want to purchase from.`
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

        Convo.getState().updateProductDetails(messageId, {
          name: productInfo.name,
          brand: productInfo.brand,
          price: productInfo.price,
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
