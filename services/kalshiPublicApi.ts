type QueryValue = string | number | boolean | undefined | null;

export type KalshiPublicEnvironment = "production" | "staging";

const KALSHI_BASE_URLS: Record<KalshiPublicEnvironment, string> = {
  production: "https://api.elections.kalshi.com/trade-api/v2",
  staging: "https://demo-api.kalshi.co/trade-api/v2",
};

function buildQueryString(query: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });
  return params.toString();
}

async function kalshiPublicGet(path: string, query: Record<string, QueryValue> = {}, env: KalshiPublicEnvironment = "production") {
  const base = KALSHI_BASE_URLS[env] ?? KALSHI_BASE_URLS.production;
  const qs = buildQueryString(query);
  const url = `${base}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { message?: string }).message || `Kalshi request failed (${res.status})`;
    throw new Error(message);
  }
  return data as any;
}

export async function getKalshiPublicSeries(args: { series_ticker: string; env?: KalshiPublicEnvironment }) {
  const ticker = args.series_ticker?.trim();
  if (!ticker) throw new Error("series_ticker is required");
  return kalshiPublicGet(`/series/${encodeURIComponent(ticker)}`, {}, args.env ?? "production");
}

export async function searchKalshiPublicMarkets(args: {
  status?: string;
  event_ticker?: string;
  series_ticker?: string;
  tickers?: string;
  limit?: number;
  cursor?: string;
  env?: KalshiPublicEnvironment;
}) {
  return kalshiPublicGet(
    "/markets",
    {
      status: args.status,
      event_ticker: args.event_ticker,
      series_ticker: args.series_ticker,
      tickers: args.tickers,
      limit: args.limit,
      cursor: args.cursor,
    },
    args.env ?? "production"
  );
}

export async function getKalshiPublicMarket(args: { ticker: string; env?: KalshiPublicEnvironment }) {
  const ticker = args.ticker?.trim();
  if (!ticker) throw new Error("ticker is required");
  return kalshiPublicGet(`/markets/${encodeURIComponent(ticker)}`, {}, args.env ?? "production");
}

export async function getKalshiPublicOrderbook(args: { ticker: string; depth?: number; env?: KalshiPublicEnvironment }) {
  const ticker = args.ticker?.trim();
  if (!ticker) throw new Error("ticker is required");
  return kalshiPublicGet(
    `/markets/${encodeURIComponent(ticker)}/orderbook`,
    {
      depth: args.depth,
    },
    args.env ?? "production"
  );
}

export async function getKalshiPublicCandlesticks(args: {
  market_tickers: string;
  start_ts: number;
  end_ts: number;
  period_interval: number;
  include_latest_before_start?: boolean;
  env?: KalshiPublicEnvironment;
}) {
  return kalshiPublicGet(
    "/markets/candlesticks",
    {
      market_tickers: args.market_tickers,
      start_ts: args.start_ts,
      end_ts: args.end_ts,
      period_interval: args.period_interval,
      include_latest_before_start: args.include_latest_before_start,
    },
    args.env ?? "production"
  );
}

