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
    /** @deprecated Wallet app uses backend POST /crossmint/wallet/orders/create (save then charge). Do not use Airbills for new orders. */
    createOrder: async ({
      payerAddress,
      asin,
    }: {
      asin: string;
      payerAddress: string;
    }) => {
      const url = `${crossmint.baseUrl}/orders`;

      // --- Validate user details before proceeding ---
      const emailParam = ToolsItem.getState().getToolParameters(
        "Amazon",
        "tracking email"
      )[0];
      const email = emailParam?.value?.trim()?.toLowerCase();
      if (!email) {
        return {
          status: false,
          message:
            "Your tracking email is not set. Please set it in the app settings (Amazon → tracking email) before placing an order.",
        };
      }

      const params = ToolsItem.getState().getToolParameters(
        "Amazon",
        "Agentic Commerce"
      );
      const requiredAddressFields = ["name", "line1", "city", "state", "postalCode", "country"];
      if (!params?.length) {
        return {
          status: false,
          message:
            "Your delivery address is not set. Please set it in the app settings (Amazon → Agentic Commerce) before placing an order.",
        };
      }

      let address = {
        name: "",
        line1: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
      };

      for (const param of params) {
        if (param.value === "" || !String(param.value).trim()) {
          return {
            status: false,
            message: `Your ${param.type} for your delivery address is not set. Please complete your delivery address in the app settings (Amazon → Agentic Commerce) before placing an order.`,
          };
        }
        address[param.type as keyof typeof address] = param.value;
      }

      const missingAddressFields = requiredAddressFields.filter(
        (field) => !address[field as keyof typeof address]?.trim()
      );
      if (missingAddressFields.length > 0) {
        return {
          status: false,
          message: `Your delivery address is incomplete. Please set ${missingAddressFields.join(", ")} in the app settings (Amazon → Agentic Commerce) before placing an order.`,
        };
      }

      const recipient = {
        email,
        physicalAddress: address,
      };
      const data = {
        recipient,
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

      try {
        const response = await request.postJsonRan(data, url, {
          "X-API-KEY": CROSSMINT_API_KEY,
        });
        if (!response.ok) {
          const result = await response.json();
          return { status: false, message: result.message };
        }
        const responseData = await response.json();
        return {
          status: true,
          data: responseData,
          message: "Order created successfully",
          recipient,
        };
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
