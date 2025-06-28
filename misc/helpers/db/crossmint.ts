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
    amazon: async (query: string) => {
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
  },
  /**
   *  "recipient": {
    "email": "filippos.lympe@gmail.com"
  },
  "payment": {
    "method": "base-sepolia", // chain the payment is on, "base" for production
    "currency": "usdc", 
    "payerAddress": "0x..." // the user's wallet (who's paying for the order) 
  },
  "lineItems": [
    {
	    // Amazon ASIN or URL, i.e. "amazon:https://www.amazon.com/dp/B07MJL8NXR"
      "productLocator": "amazon:B07MJL8NXR"
    }
  ]
   */

  orders: {
    createOrder: async ({
      email,
      payerAddress,
      currency,
    }: {
      asin: string;
      email: string;
      payerAddress: string;
      currency: string;
    }) => {
      const url = `${crossmint.baseUrl}/orders`;
      const data = {
        recipient: {
          email: email,
        },
        payment: {
          method: "solana",
          currency: currency,
          payerAddress: payerAddress,
        },
      };

      try {
        const response = await request.postJsonRan({}, url, {
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
