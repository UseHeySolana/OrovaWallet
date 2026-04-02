import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import UserItem from "@/utils/store/userstore.store";
import Convo from "@/utils/store/conversation.store";
import {
  activateKalshiWallet,
  getKalshiPortfolioOrders,
  getKalshiPositions,
  getKalshiWalletStatus,
  placeKalshiOrder,
  cancelKalshiOrder,
} from "@/services/kalshiApi";
import {
  getKalshiPublicCandlesticks,
  getKalshiPublicMarket,
  getKalshiPublicOrderbook,
  getKalshiPublicSeries,
  searchKalshiPublicMarkets,
  type KalshiPublicEnvironment,
} from "@/services/kalshiPublicApi";

// NOTE: The app store entry is named "Kalshi", but earlier versions used
// "Kalshi Prediction Markets". We support both to avoid missing locally-saved creds.
const KALSHI_APP_NAME = "Kalshi Prediction Markets";
const KALSHI_APP_NAME_ALT = "Kalshi";
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

function getSettingValue(paramType: string): string {
  const store = ToolsItem.getState();
  return (
    store.getParameterValue(KALSHI_APP_NAME, KALSHI_CONFIG, paramType).trim() ||
    store.getParameterValue(KALSHI_APP_NAME_ALT, KALSHI_CONFIG, paramType).trim()
  );
}

function getApiKeyIdFromSettings(): string {
  return getSettingValue("kalshi_access_key_id");
}

function getPrivateKeyFromSettings(): string {
  return getSettingValue("private_key");
}

function getEnvironmentFromSettings(): "production" | "staging" | undefined {
  const env = getSettingValue("environment");
  if (env === "production" || env === "staging") return env;
  return undefined;
}

function getKeyLabelFromSettings(): string {
  return getSettingValue("key_label");
}

function getPublicEnv(): KalshiPublicEnvironment {
  return getEnvironmentFromSettings() ?? "production";
}

export class KalshiTool {
  public activateKalshi: FunctionParams;
  public backupApiKey: FunctionParams;
  public kalshiStatus: FunctionParams;
  public getSeries: FunctionParams;
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
    this.getSeries = this.get_series();
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

        const identity = getIdentityPayload();

        // First read local creds (AsyncStorage-backed ToolsItem) so we can report
        // readiness even if backend sync hasn't happened yet.
        const localPrivateKey = getPrivateKeyFromSettings();
        const localKeyId = getApiKeyIdFromSettings();
        const localEnv = getEnvironmentFromSettings();
        const localKeyLabel = getKeyLabelFromSettings();

        const localStatus = {
          has_private_key: !!localPrivateKey,
          has_access_key_id: !!localKeyId,
          environment: localEnv ?? null,
          key_label: localKeyLabel || null,
        };

        // Always check backend status (source of truth for trading proxy readiness).
        let backendStatus: any;
        try {
          backendStatus = await getKalshiWalletStatus(identity);
        } catch (e: any) {
          return JSON.stringify({
            ok: false,
            local: localStatus,
            backend_error: e?.message || "Failed to fetch backend status",
          });
        }

        // If local creds exist but backend is not ready, sync them up automatically.
        const backendReady =
          !!backendStatus?.is_active &&
          !!backendStatus?.has_private_key &&
          !!backendStatus?.has_access_key_id;

        const localReady = localStatus.has_private_key && localStatus.has_access_key_id;

        if (localReady && !backendReady) {
          try {
            await activateKalshiWallet({
              ...identity,
              private_key: localPrivateKey,
              kalshi_access_key_id: localKeyId,
              key_label: localKeyLabel || "HeySolana Wallet Key",
              environment: (localEnv ?? "production") as "production" | "staging",
            });
            backendStatus = await getKalshiWalletStatus(identity);
          } catch (e: any) {
            return JSON.stringify({
              ok: false,
              local: localStatus,
              backend: backendStatus,
              sync_error: e?.message || "Failed to sync local creds to backend",
            });
          }
        }

        return JSON.stringify({
          ok: true,
          local: localStatus,
          backend: backendStatus,
          synced: localReady && !backendReady ? true : false,
        });
      },
    };
  }

  get_series(): FunctionParams {
    return {
      name: "get-kalshi-series",
      description: "Fetch a Kalshi series by its series ticker (public market data; no authentication required).",
      parameters: {
        type: "object",
        properties: {
          series_ticker: { type: "string", description: "Series ticker, e.g. KXHIGHNY" },
        },
        required: ["series_ticker"],
      },
      handler: async (args: { series_ticker: string }) => {
        const env = getPublicEnv();
        const data = await getKalshiPublicSeries({ series_ticker: args.series_ticker, env });
        return JSON.stringify(data);
      },
    };
  }

  search_markets(): FunctionParams {
    return {
      name: "search-kalshi-markets",
      description:
        "Search Kalshi prediction markets by filters like series ticker, event ticker, or status (public market data; no authentication required).",
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
        const messageId = this.session.functionMessageId;
        const env = getPublicEnv();
        const result = await searchKalshiPublicMarkets({
          status: args.status,
          event_ticker: args.event_ticker,
          series_ticker: args.series_ticker,
          limit: args.limit || 20,
          env,
        });
        const payload = result?.data || result;

        const markets = payload && typeof payload === "object" && Array.isArray((payload as any).markets)
          ? (payload as any).markets
          : null;

        if (messageId && markets) {
          Convo.getState().updateMessage({
            messageId,
            content: {
              messageType: "kalshi",
              markets,
            },
            source: "kalshi",
          });
        }

        return JSON.stringify(payload);
      },
    };
  }

  market_details(): FunctionParams {
    return {
      name: "get-kalshi-market-details",
      description:
        "Fetch details and orderbook for a specific Kalshi market ticker (public market data; no authentication required).",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "Kalshi market ticker" },
          depth: { type: "number", description: "Orderbook depth (optional)" },
        },
        required: ["ticker"],
      },
      handler: async (args: { ticker: string; depth?: number }) => {
        const env = getPublicEnv();
        const [market, orderbook] = await Promise.all([
          getKalshiPublicMarket({ ticker: args.ticker, env }),
          getKalshiPublicOrderbook({ ticker: args.ticker, depth: args.depth ?? 20, env }),
        ]);
        return JSON.stringify({
          market,
          orderbook,
        });
      },
    };
  }

  market_price_data(): FunctionParams {
    return {
      name: "get-kalshi-odds-and-chart",
      description:
        "Get orderbook and candlestick price data for a Kalshi ticker (public market data; no authentication required).",
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
        const env = getPublicEnv();
        const [orderbook, candles] = await Promise.all([
          getKalshiPublicOrderbook({ ticker: args.ticker, depth: 20, env }),
          getKalshiPublicCandlesticks({
            market_tickers: args.ticker,
            start_ts: args.start_ts,
            end_ts: args.end_ts,
            period_interval: args.period_interval,
            env,
          }),
        ]);

        return JSON.stringify({
          orderbook,
          candlesticks: candles,
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

