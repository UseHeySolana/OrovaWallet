import AppSettings from "@/misc/store/settingsstore";
import SessionManager from "../aistream/aistream";
import { FunctionParams } from "../types";
import UserItem from "@/misc/store/userstore";
import WalletItem from "@/misc/store/wallet";
import {
  cleanNumber,
  convertSpeech,
  signTransactions,
  summarizeProduct,
} from "../miscfunctions.ts/extrafunctions";
import Convo from "@/misc/store/conversation";
import {
  completeConversation,
  getInTokenBalance,
  getUserDetails,
} from "../miscfunctions.ts";
import { transferSol, transferToken } from "../transfers";
import ToolsItem from "@/misc/store/toolsitems";
import { crossmint } from "../db/crossmint";

export class Crossmint {
  public searchProductsAmazon: FunctionParams;
  public createAmazonOrder: FunctionParams;
  public selectProduct: FunctionParams;
  public productDetails: FunctionParams;

  constructor(public session: SessionManager) {
    this.createAmazonOrder = this.create_order();
    this.searchProductsAmazon = this.search_product();
    this.selectProduct = this.select_product();
    this.productDetails = this.product_details();
  }

  create_order() {
    return {
      name: "create-amazon-order",
      description: "This function is used to create an order on amazon",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description:
              "This is the amount of solana tokens you want to offramp, it should be a number",
          },
          token: {
            type: "string",
            description:
              "This is the token you want to offramp, it should be a string",
          },
        },
        required: ["amount", "token"],
      },

      handler: async (args: { amount: number; token: string }) => {
        const tokenBalance = getInTokenBalance(args.token);

        const tokens: any = this.session.userDetails.tokenAccounts.filter(
          (item: any) =>
            item?.symbol?.toLowerCase() === args.token.toLowerCase()
        );

        if (tokenBalance < args.amount)
          return `Insufficient ${args.token} balance to offramp`;

        const accountNumber = ToolsItem.getState().getParameterValue(
          "Pajcash",
          "offramp",
          "account_number"
        );

        if (!accountNumber)
          return "You have not set your account number, please set your account number first";

        const recipient = "PAJiUaKgxTBJVADc1wdiUygLd51biQPVB8KkJqYu53L";

        let confirmation = null;

        if (args.token.toLowerCase() == "sol") {
          const transfer = await transferSol(
            recipient,
            args.amount,
            this.session.connection
          );

          confirmation = await this.session.connection.confirmTransaction(
            transfer.message,
            "confirmed"
          );
        } else {
          const transfer = await transferToken(
            recipient,
            tokens[0].mint,
            args.amount,
            tokens[0].decimals,
            this.session.connection
          );
          confirmation = await this.session.connection.confirmTransaction(
            transfer.message,
            "confirmed"
          );
        }

        if (confirmation) {
          return `You have successfully Paj ${args.amount} ${args.token} to Naira`;
        } else {
          return `Failed to Paj ${args.amount} ${args.token} to Naira`;
        }
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

  select_product() {
    return {
      name: "select-product",
      description:
        "This function is used to select a product from the list of products and return the product details",
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

        return convertSpeech(
          `The product you selected is ${product.name} and the price is ${product.price}
          The details are above, do let me know if you want to proceed with the purchase
          `
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

        const product = items.product_information;

        const summary = await summarizeProduct(product);
        completeConversation(messageId, "complete");
        return summary;
      },
    };
  }
}
