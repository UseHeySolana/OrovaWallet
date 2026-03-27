import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import UserItem from "@/utils/store/userstore.store";
import {
  activateKalshiWallet,
  backupKalshiApiKey,
  getKalshiCandlesticks,
  getKalshiMarket,
  getKalshiOrderbook,
  getKalshiPortfolioOrders,
  getKalshiPositions,
  getKalshiWalletStatus,
  placeKalshiOrder,
  searchKalshiMarkets,
  cancelKalshiOrder,
} from "@/services/kalshiApi";

const KALSHI_APP_NAME = "Kalshi Prediction Markets";
const KALSHI_CONFIG = "credentials";

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

function getApiKeyIdFromSettings(): string {
  return ToolsItem.getState()
    .getParameterValue(KALSHI_APP_NAME, KALSHI_CONFIG, "kalshi_access_key_id")
    .trim();
}

function getPrivateKeyFromSettings(): string {
  return ToolsItem.getState()
    .getParameterValue(KALSHI_APP_NAME, KALSHI_CONFIG, "private_key")
    .trim();
}

export class KalshiTool {
  public activateKalshi: FunctionParams;
  public backupApiKey: FunctionParams;
  public kalshiStatus: FunctionParams;
  public searchMarkets: FunctionParams;
  public marketDetails: FunctionParams;
  public marketPriceData: FunctionParams;
  public placeOrder: FunctionParams;
  public cancelOrder: FunctionParams;
  public getOrders: FunctionParams;
  public getPositions: FunctionParams;

  constructor(public session: SessionManager) {
    this.activateKalshi = this.activate_kalshi();
    this.backupApiKey = this.backup_api_key();
    this.kalshiStatus = this.kalshi_status();
    this.searchMarkets = this.search_markets();
    this.marketDetails = this.market_details();
    this.marketPriceData = this.market_price_data();
    this.placeOrder = this.place_order();
    this.cancelOrder = this.cancel_order();
    this.getOrders = this.get_orders();
    this.getPositions = this.get_positions();
  }

  activate_kalshi(): FunctionParams {
    return {
      name: "activate-kalshi",
      description:
        "Activate Kalshi Prediction Markets for this wallet by importing your Kalshi-generated private key and key id into secure backend storage.",
      parameters: {
        type: "object",
        properties: {
          private_key: {
            type: "string",
            description: "Kalshi generated private key in PEM format",
          },
          kalshi_access_key_id: {
            type: "string",
            description: "Kalshi key id shown when API key is created",
          },
          key_label: {
            type: "string",
            description: "Optional key label for Kalshi API key registration",
          },
          environment: {
            type: "string",
            description: "Kalshi environment: production or staging",
          },
        },
        required: [],
      },
      handler: async (args: {
        private_key?: string;
        kalshi_access_key_id?: string;
        key_label?: string;
        environment?: "production" | "staging";
      }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) {
          return "User identity not available. Please sign in first.";
        }

        const privateKey = args.private_key?.trim() || getPrivateKeyFromSettings();
        const keyId = args.kalshi_access_key_id?.trim() || getApiKeyIdFromSettings();
        if (!privateKey || !keyId) {
          return "Kalshi activation needs both private key and key id. Add them in Settings > Apps > Kalshi Prediction Markets.";
        }

        const data = await activateKalshiWallet({
          ...getIdentityPayload(),
          private_key: privateKey,
          kalshi_access_key_id: keyId,
          key_label: args.key_label?.trim() || "HeySolana Wallet Key",
          environment: args.environment || "production",
        });

        const payload = data?.data || {};
        ToolsItem.getState().updateToolParameter(KALSHI_APP_NAME, KALSHI_CONFIG, {
          type: "kalshi_access_key_id",
          value: keyId,
        });
        ToolsItem.getState().updateToolParameter(KALSHI_APP_NAME, KALSHI_CONFIG, {
          type: "key_label",
          value: payload.key_label || "",
        });

        return `Kalshi credentials imported. Fingerprint: ${payload.private_key_fingerprint || "N/A"}. Trading functions are now ready.`;
      },
    };
  }

  backup_api_key(): FunctionParams {
    return {
      name: "backup-kalshi-api-key",
      description:
        "Back up the Kalshi access key id for this wallet to the backend, so requests can be signed server-side.",
      parameters: {
        type: "object",
        properties: {
          kalshi_access_key_id: {
            type: "string",
            description: "Kalshi access key id",
          },
        },
        required: [],
      },
      handler: async (args: { kalshi_access_key_id?: string }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) {
          return "User identity not available. Please sign in first.";
        }

        const keyId = args.kalshi_access_key_id?.trim() || getApiKeyIdFromSettings();
        const privateKey = getPrivateKeyFromSettings();
        if (!keyId || !privateKey) {
          return "Kalshi backup needs key id and private key configured in Settings > Apps > Kalshi Prediction Markets.";
        }

        await activateKalshiWallet({
          ...getIdentityPayload(),
          private_key: privateKey,
          kalshi_access_key_id: keyId,
        });

        ToolsItem.getState().updateToolParameter(KALSHI_APP_NAME, KALSHI_CONFIG, {
          type: "kalshi_access_key_id",
          value: keyId,
        });

        return "Kalshi credentials synced to backend.";
      },
    };
  }

  kalshi_status(): FunctionParams {
    return {
      name: "get-kalshi-status",
      description: "Check whether Kalshi is activated and ready for this wallet.",
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

        const status = await getKalshiWalletStatus(getIdentityPayload());
        return JSON.stringify(status);
      },
    };
  }

  search_markets(): FunctionParams {
    return {
      name: "search-kalshi-markets",
      description: "Search Kalshi prediction markets by filters like event ticker or status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Market status: unopened, open, closed, settled" },
          event_ticker: { type: "string", description: "Optional event ticker filter" },
          series_ticker: { type: "string", description: "Optional series ticker filter" },
          limit: { type: "number", description: "Number of markets to return" },
        },
        required: [],
      },
      handler: async (args: { status?: string; event_ticker?: string; series_ticker?: string; limit?: number }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await searchKalshiMarkets({
          ...getIdentityPayload(),
          status: args.status,
          event_ticker: args.event_ticker,
          series_ticker: args.series_ticker,
          limit: args.limit || 20,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  market_details(): FunctionParams {
    return {
      name: "get-kalshi-market-details",
      description: "Fetch details and orderbook for a specific Kalshi market ticker.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "Kalshi market ticker" },
          depth: { type: "number", description: "Orderbook depth (optional)" },
        },
        required: ["ticker"],
      },
      handler: async (args: { ticker: string; depth?: number }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const [market, orderbook] = await Promise.all([
          getKalshiMarket({ ...getIdentityPayload(), ticker: args.ticker }),
          getKalshiOrderbook({ ...getIdentityPayload(), ticker: args.ticker, depth: args.depth ?? 20 }),
        ]);
        return JSON.stringify({
          market: market?.data || market,
          orderbook: orderbook?.data || orderbook,
        });
      },
    };
  }

  market_price_data(): FunctionParams {
    return {
      name: "get-kalshi-odds-and-chart",
      description: "Get orderbook and candlestick price data for a Kalshi ticker.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "Kalshi market ticker" },
          period_interval: { type: "number", description: "Candlestick period in minutes (1, 60, 1440)" },
          start_ts: { type: "number", description: "Start timestamp (unix seconds)" },
          end_ts: { type: "number", description: "End timestamp (unix seconds)" },
        },
        required: ["ticker", "period_interval", "start_ts", "end_ts"],
      },
      handler: async (args: { ticker: string; period_interval: number; start_ts: number; end_ts: number }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const [orderbook, candles] = await Promise.all([
          getKalshiOrderbook({ ...getIdentityPayload(), ticker: args.ticker, depth: 20 }),
          getKalshiCandlesticks({
            ...getIdentityPayload(),
            market_tickers: args.ticker,
            start_ts: args.start_ts,
            end_ts: args.end_ts,
            period_interval: args.period_interval,
          }),
        ]);

        return JSON.stringify({
          orderbook: orderbook?.data || orderbook,
          candlesticks: candles?.data || candles,
        });
      },
    };
  }

  place_order(): FunctionParams {
    return {
      name: "place-kalshi-order",
      description: "Place a Kalshi order in a market (limit or market order).",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "Market ticker" },
          side: { type: "string", description: "yes or no side" },
          action: { type: "string", description: "buy or sell" },
          count: { type: "number", description: "Number of contracts" },
          type: { type: "string", description: "market or limit" },
          price: { type: "number", description: "Price in cents for limit order" },
        },
        required: ["ticker", "side", "action", "count", "type"],
      },
      handler: async (args: {
        ticker: string;
        side: string;
        action: string;
        count: number;
        type: string;
        price?: number;
      }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";

        const order: Record<string, unknown> = {
          ticker: args.ticker,
          side: args.side,
          action: args.action,
          count: Math.max(1, Math.floor(args.count)),
          type: args.type,
        };
        if (args.price !== undefined) {
          order.price = args.price;
        }

        const result = await placeKalshiOrder({
          ...getIdentityPayload(),
          order,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  cancel_order(): FunctionParams {
    return {
      name: "cancel-kalshi-order",
      description: "Cancel an existing Kalshi order by order id.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "Kalshi order id" },
        },
        required: ["order_id"],
      },
      handler: async (args: { order_id: string }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await cancelKalshiOrder({
          ...getIdentityPayload(),
          order_id: args.order_id,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  get_orders(): FunctionParams {
    return {
      name: "get-kalshi-orders",
      description: "Get current or historical Kalshi orders for this wallet.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "resting, canceled, executed" },
          ticker: { type: "string", description: "Optional market ticker filter" },
          limit: { type: "number", description: "Result page size" },
        },
        required: [],
      },
      handler: async (args: { status?: string; ticker?: string; limit?: number }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await getKalshiPortfolioOrders({
          ...getIdentityPayload(),
          status: args.status,
          ticker: args.ticker,
          limit: args.limit || 50,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }

  get_positions(): FunctionParams {
    return {
      name: "get-kalshi-positions",
      description: "Get Kalshi positions for this wallet.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "Optional market ticker filter" },
          event_ticker: { type: "string", description: "Optional event filter" },
          limit: { type: "number", description: "Result page size" },
        },
        required: [],
      },
      handler: async (args: { ticker?: string; event_ticker?: string; limit?: number }) => {
        const walletAddress = getWalletAddress();
        const phoneNumber = getPhoneNumber();
        if (!walletAddress && !phoneNumber) return "User identity not available. Please sign in first.";
        const result = await getKalshiPositions({
          ...getIdentityPayload(),
          ticker: args.ticker,
          event_ticker: args.event_ticker,
          limit: args.limit || 50,
        });
        return JSON.stringify(result?.data || result);
      },
    };
  }
}

