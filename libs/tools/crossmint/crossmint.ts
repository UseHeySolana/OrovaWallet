import ToolsItem from "@/utils/store/toolsitems.store";
import { CROSSMINT_API_KEY, SCRAPER_API_KEY } from "@/utils/constant";
import { request } from "@/utils/request/db";

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
      payerAddress,
      asin,
    }: {
      asin: string;
      payerAddress: string;
    }) => {
      const url = `${crossmint.baseUrl}/orders`;

      const params = ToolsItem.getState().getToolParameters(
        "Crossmint",
        "Agentic Commerce"
      );

      const email = ToolsItem.getState()
        .getToolParameters("Crossmint", "tracking email")[0]
        ?.value.toLowerCase();

      let address = {
        name: "",
        line1: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
      };

      for (const param of params) {
        if (param.value === "") {
          return {
            status: false,
            message: `Your ${param.type} for your delivery address is not set, please set it first`,
          };
        }
        address[param.type as keyof typeof address] = param.value;
      }

      const data = {
        recipient: {
          email,
          physicalAddress: address,
        },
        payment: {
          method: "solana",
          payerAddress: payerAddress,
        },
        lineItems: [
          {
            productLocator: `amazon:${asin}`,
          },
        ],
      };

      console.log(data);
      return {
        status: true,
        data,
        message: "Order created successfully",
        orderId: "1234567890",
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
