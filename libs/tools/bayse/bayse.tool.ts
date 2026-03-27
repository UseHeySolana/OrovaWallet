import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import UserItem from "@/utils/store/userstore.store";
import {
  activateBayseWallet,
  cancelBayseOrder,
  getBayseActivities,
  getBayseOrders,
  getBaysePortfolio,
  getBayseQuote,
  getBayseWalletStatus,
  placeBayseOrder,
  searchBayseEvents,
} from "@/services/bayseApi";

const BAYSE_APP_NAME = "Bayse Prediction Markets";
const BAYSE_CONFIG = "credentials";

function getWalletAddress(): string {
  return WalletItem.getState().publicKey?.toString() ?? "";
}

function getPhoneNumber(): string {
  return UserItem.getState().user?.mobileNumber?.trim() ?? "";
}

function getIdentityPayload() {
  const phoneNumber = getPhoneNumber();
  const walletAddress = getWalletAddress();
  return {
    phone_number: phoneNumber || undefined,
    wallet_address: walletAddress || undefined,
  };
}

function getPublicKeyFromSettings(): string {
  return ToolsItem.getState()
    .getParameterValue(BAYSE_APP_NAME, BAYSE_CONFIG, "public_key")
    .trim();
}

function getSecretKeyFromSettings(): string {
  return ToolsItem.getState()
    .getParameterValue(BAYSE_APP_NAME, BAYSE_CONFIG, "secret_key")
    .trim();
}

function getDefaultCurrencyFromSettings(): "USD" | "NGN" {
  const currency = ToolsItem.getState()
    .getParameterValue(BAYSE_APP_NAME, BAYSE_CONFIG, "default_currency")
    .trim()
    .toUpperCase();
  return currency === "NGN" ? "NGN" : "USD";
}

export class BayseTool {
  public activateBayse: FunctionParams;
  public bayseStatus: FunctionParams;
  public searchEvents: FunctionParams;
  public getQuote: FunctionParams;
  public placeOrder: FunctionParams;
  public cancelOrder: FunctionParams;
  public getOrders: FunctionParams;
  public getPortfolio: FunctionParams;
  public getActivities: FunctionParams;

  constructor(public session: SessionManager) {
    this.activateBayse = this.activate_bayse();
    this.bayseStatus = this.bayse_status();
    this.searchEvents = this.search_events();
    this.getQuote = this.get_quote();
    this.placeOrder = this.place_order();
    this.cancelOrder = this.cancel_order();
    this.getOrders = this.get_orders();
    this.getPortfolio = this.get_portfolio();
    this.getActivities = this.get_activities();
  }

  activate_bayse(): FunctionParams {
    return {
      name: "activate-bayse",
      description:
        "Activate Bayse Prediction Markets by securely saving your Bayse public and secret API keys for server-side request signing.",
      parameters: {
        type: "object",
        properties: {
          public_key: { type: "string", description: "Bayse public key (pk_*)" },
          secret_key: { type: "string", description: "Bayse secret key (sk_*)" },
          key_label: { type: "string", description: "Optional nickname for this key pair" },
          default_currency: { type: "string", description: "USD or NGN" },
        },
        required: [],
      },
      handler: async (args: {
        public_key?: string;
        secret_key?: string;
        key_label?: string;
        default_currency?: "USD" | "NGN";
      }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) {
          return "User identity not available. Please sign in first.";
        }

        const publicKey = args.public_key?.trim() || getPublicKeyFromSettings();
        const secretKey = args.secret_key?.trim() || getSecretKeyFromSettings();
        if (!publicKey || !secretKey) {
          return "Bayse activation needs both public and secret keys. Add them in Settings > Apps > Bayse Prediction Markets.";
        }

        const currency = args.default_currency || getDefaultCurrencyFromSettings();
        const data = await activateBayseWallet({
          ...getIdentityPayload(),
          public_key: publicKey,
          secret_key: secretKey,
          key_label: args.key_label?.trim() || "HeySolana Wallet Key",
          default_currency: currency,
        });

        const payload = data?.data || {};
        ToolsItem.getState().updateToolParameter(BAYSE_APP_NAME, BAYSE_CONFIG, {
          type: "public_key",
          value: publicKey,
        });
        ToolsItem.getState().updateToolParameter(BAYSE_APP_NAME, BAYSE_CONFIG, {
          type: "key_label",
          value: payload.key_label || "",
        });
        ToolsItem.getState().updateToolParameter(BAYSE_APP_NAME, BAYSE_CONFIG, {
          type: "default_currency",
          value: payload.default_currency || currency,
        });

        return `Bayse credentials imported. Fingerprint: ${payload.key_fingerprint || "N/A"}. Trading functions are now ready.`;
      },
    };
  }

  bayse_status(): FunctionParams {
    return {
      name: "get-bayse-status",
      description: "Check whether Bayse is activated and ready for this wallet.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async () => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) {
          return "User identity not available. Please sign in first.";
        }
        const status = await getBayseWalletStatus(getIdentityPayload());
        return JSON.stringify(status);
      },
    };
  }

  search_events(): FunctionParams {
    return {
      name: "search-bayse-events",
      description: "Search Bayse prediction events by keyword, category, status, and currency.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Text search in event title" },
          category: { type: "string", description: "Category filter, e.g. sports, politics, crypto" },
          status: { type: "string", description: "Event status, e.g. open, closed, settled" },
          trending: { type: "boolean", description: "Filter to trending events" },
          currency: { type: "string", description: "USD or NGN pricing" },
          limit: { type: "number", description: "Number of results to return" },
          offset: { type: "number", description: "Pagination offset" },
        },
        required: [],
      },
      handler: async (args: {
        keyword?: string;
        category?: string;
        status?: string;
        trending?: boolean;
        currency?: "USD" | "NGN";
        limit?: number;
        offset?: number;
      }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await searchBayseEvents({
          ...getIdentityPayload(),
          keyword: args.keyword,
          category: args.category,
          status: args.status,
          trending: args.trending,
          currency: args.currency || getDefaultCurrencyFromSettings(),
          limit: args.limit || 20,
          offset: args.offset || 0,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  get_quote(): FunctionParams {
    return {
      name: "get-bayse-quote",
      description: "Get expected price, shares, and fees before placing a Bayse order.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Bayse event id" },
          market_id: { type: "string", description: "Bayse market id" },
          side: { type: "string", description: "BUY or SELL" },
          outcome: { type: "string", description: "Outcome label or id" },
          amount: { type: "number", description: "Amount in selected currency" },
          currency: { type: "string", description: "USD or NGN" },
        },
        required: ["event_id", "market_id", "side", "outcome", "amount"],
      },
      handler: async (args: {
        event_id: string;
        market_id: string;
        side: "BUY" | "SELL";
        outcome: string;
        amount: number;
        currency?: "USD" | "NGN";
      }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await getBayseQuote({
          ...getIdentityPayload(),
          ...args,
          currency: args.currency || getDefaultCurrencyFromSettings(),
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  place_order(): FunctionParams {
    return {
      name: "place-bayse-order",
      description: "Place a Bayse order for an event market.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Bayse event id" },
          market_id: { type: "string", description: "Bayse market id" },
          side: { type: "string", description: "BUY or SELL" },
          outcome: { type: "string", description: "Outcome label or id" },
          amount: { type: "number", description: "Order amount" },
          currency: { type: "string", description: "USD or NGN" },
          price: { type: "number", description: "Optional limit price for CLOB markets" },
          order_type: { type: "string", description: "market or limit" },
          time_in_force: { type: "string", description: "GTC, FAK, FOK, GTD (CLOB only)" },
        },
        required: ["event_id", "market_id", "side", "outcome", "amount"],
      },
      handler: async (args: {
        event_id: string;
        market_id: string;
        side: "BUY" | "SELL";
        outcome: string;
        amount: number;
        currency?: "USD" | "NGN";
        price?: number;
        order_type?: string;
        time_in_force?: string;
      }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";

        const order: Record<string, unknown> = {
          side: String(args.side || "BUY").toUpperCase(),
          outcome: args.outcome,
          amount: Math.max(1, Number(args.amount || 0)),
          currency: args.currency || getDefaultCurrencyFromSettings(),
        };
        if (args.price !== undefined) order.price = args.price;
        if (args.order_type) order.order_type = args.order_type;
        if (args.time_in_force) order.time_in_force = args.time_in_force;

        const result = await placeBayseOrder({
          ...getIdentityPayload(),
          event_id: args.event_id,
          market_id: args.market_id,
          order,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  cancel_order(): FunctionParams {
    return {
      name: "cancel-bayse-order",
      description: "Cancel an existing Bayse order by id.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "Bayse order id" },
        },
        required: ["order_id"],
      },
      handler: async (args: { order_id: string }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await cancelBayseOrder({
          ...getIdentityPayload(),
          order_id: args.order_id,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  get_orders(): FunctionParams {
    return {
      name: "get-bayse-orders",
      description: "Get Bayse orders for this wallet.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Order status filter" },
          limit: { type: "number", description: "Result page size" },
          offset: { type: "number", description: "Pagination offset" },
        },
        required: [],
      },
      handler: async (args: { status?: string; limit?: number; offset?: number }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await getBayseOrders({
          ...getIdentityPayload(),
          status: args.status,
          limit: args.limit || 50,
          offset: args.offset || 0,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  get_portfolio(): FunctionParams {
    return {
      name: "get-bayse-portfolio",
      description: "Get Bayse portfolio positions for this wallet.",
      parameters: {
        type: "object",
        properties: {
          currency: { type: "string", description: "USD or NGN" },
        },
        required: [],
      },
      handler: async (args: { currency?: "USD" | "NGN" }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await getBaysePortfolio({
          ...getIdentityPayload(),
          currency: args.currency || getDefaultCurrencyFromSettings(),
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  get_activities(): FunctionParams {
    return {
      name: "get-bayse-activities",
      description: "Get recent Bayse account activities for this wallet.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Result page size" },
          offset: { type: "number", description: "Pagination offset" },
        },
        required: [],
      },
      handler: async (args: { limit?: number; offset?: number }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await getBayseActivities({
          ...getIdentityPayload(),
          limit: args.limit || 50,
          offset: args.offset || 0,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }
}

