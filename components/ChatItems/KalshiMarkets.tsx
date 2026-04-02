import React, { useMemo } from "react";
import { ScrollView, View } from "react-native";
import CText from "../TextComp";
import Buttons from "../ButtonComp";

type KalshiMarket = {
  ticker?: string;
  title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
  volume_24h_fp?: string;
  close_time?: string;
  status?: string;
};

function toNumberMaybe(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatPct(n: number | null): string {
  if (n === null) return "--";
  const pct = Math.max(0, Math.min(100, n * 100));
  return `${Math.round(pct)}%`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

interface KalshiMarketsProps {
  markets: KalshiMarket[];
  sessionManager: any;
}

export default function KalshiMarkets({ markets, sessionManager }: KalshiMarketsProps) {
  const top = useMemo(() => (Array.isArray(markets) ? markets.slice(0, 10) : []), [markets]);

  if (!top.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingRight: 50 }}
    >
      {top.map((m, idx) => {
        const bid = toNumberMaybe(m.yes_bid_dollars);
        const ask = toNumberMaybe(m.yes_ask_dollars);
        const last = toNumberMaybe(m.last_price_dollars);
        const mid = bid !== null && ask !== null ? (bid + ask) / 2 : last;

        return (
          <View
            key={`${m.ticker ?? "m"}-${idx}`}
            className="flex flex-col items-start justify-between bg-white dark:bg-accent shadow-lg p-3 w-[240px] rounded-2xl"
          >
            <View className="w-full gap-y-2">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <CText className="text-[12px]" style={{ fontFamily: "bold" }}>
                    {m.title ?? "Kalshi Market"}
                  </CText>
                  {!!m.ticker && <CText className="text-[10px] opacity-70">{m.ticker}</CText>}
                </View>
                <View className="bg-grey dark:bg-accent2 px-3 py-2 rounded-full">
                  <CText className="text-[14px]" style={{ fontFamily: "bold" }}>
                    {formatPct(mid)}
                  </CText>
                </View>
              </View>

              <View className="flex-row items-center justify-between">
                <CText className="text-[10px] opacity-80">
                  YES {bid !== null ? bid.toFixed(3) : "--"} / {ask !== null ? ask.toFixed(3) : "--"}
                </CText>
                <CText className="text-[10px] opacity-80">
                  Vol {toNumberMaybe(m.volume_24h_fp)?.toFixed(2) ?? "--"}
                </CText>
              </View>

              {!!m.close_time && (
                <CText className="text-[10px] opacity-70">Closes {formatDate(m.close_time)}</CText>
              )}
              {!!m.status && <CText className="text-[10px] opacity-70">Status {m.status}</CText>}
            </View>

            <View className="w-full pt-3">
              <Buttons
                text="Select"
                onPress={() => {
                  if (!m.ticker) return;
                  sessionManager?.sendTextMessage?.(
                    `Select Kalshi market ${m.ticker} and show details / orderbook`
                  );
                }}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

