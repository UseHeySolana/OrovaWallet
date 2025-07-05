import ToolsItem from "@/misc/store/toolsitems";
import { CROSSMINT_API_KEY, SCRAPER_API_KEY } from "./constant";
import { request } from "./db";

const crossmint = {
  baseUrl: "https://vendor.airbillspay.com/api/2022-06-09/",
  stagingUrl: "https://staging.crossmint.com/api/2022-06-09/",
  /**
   *
   * @param phone_number
   * @param amount
   * @param token
   * @param userWalletAddress
   * @returns
   */

  search: {
    amazon: {
      search: async (query: string) => {
        const url = `https://api.scraperapi.com/structured/amazon/search?api_key=${SCRAPER_API_KEY}&query=${query}`;

        try {
          const response = await request.getRan(url);
          if (!response.ok) {
            const result = await response.json();
            return {
              status: false,
              message: result.message,
            };
          }
          return { status: true, data: await response.json() };
        } catch (error) {
          console.log(error);
          return { status: false, message: error };
        }
      },
      get: async (productId: string) => {
        const url = `https://api.scraperapi.com/structured/amazon/product?api_key=${SCRAPER_API_KEY}&asin=${productId}`;
        try {
          const response = await request.getRan(url);
          if (!response.ok) {
            const result = await response.json();
            return { status: false, message: result.message };
          }
          return { status: true, data: await response.json() };
        } catch (error) {
          console.log(error);
          return { status: false, message: error };
        }
      },
    },
  },

  orders: {
    createOrder: async ({
      email,
      payerAddress,
      currency,
      asin,
    }: {
      asin: string;
      email: string;
      payerAddress: string;
      currency: string;
    }) => {
      const url = `${crossmint.baseUrl}/orders`;

      const address = ToolsItem.getState().getParameterValue(
        "Crossmint",
        "address",
        "address"
      );

      const data = {
        recipient: {
          email: email,
          physicalAddress: {
            name: "Filippos L",
            line1: "14 ABC Street",
            city: "New York City",
            state: "NY",
            postalCode: "10007",
            country: "US",
          },
        },
        payment: {
          method: "solana",
          currency: currency,
          payerAddress: payerAddress,
        },
        lineItems: [
          {
            productLocator: `amazon:${asin}`,
          },
        ],
      };

      try {
        const response = await request.postJsonRan(data, url, {
          "X-API-KEY": CROSSMINT_API_KEY,
        });
        if (!response.ok) {
          const result = await response.json();
          return { status: false, message: result.message };
        }
        return { status: true, data: await response.json() };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },

    getOrder: async (orderId: string) => {
      const url = `${crossmint.baseUrl}/orders/${orderId}`;
      try {
        const response = await request.getRan(url, {
          "X-API-KEY": CROSSMINT_API_KEY,
        });
        if (!response.ok) {
          const result = await response.json();
          return { status: false, message: result.message };
        }
        return { status: true, data: await response.json() };
      } catch (error) {
        console.log(error);
        return { status: false, message: error };
      }
    },
  },
};

export { crossmint };
