import * as Notifications from "expo-notifications";
import AppSettings from "@/utils/store/settingsstore.store";
import BrainStore, { PriceAlert } from "@/utils/store/brain.store";

export interface PriceTick {
  tokenId: string;
  usd: number;
  timestamp: number;
}

/**
 * Polls Jupiter lite price endpoint and triggers alerts while the app is active.
 * This is intentionally foreground-only (reliable on iOS + Android without background fetch).
 */
export class PriceWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private inFlight = false;

  start() {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const interval = BrainStore.getState().pollIntervalMs;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick().catch(() => {
        // ignore tick failures
      });
    }, interval);

    // First tick immediately so user doesn't wait a full interval.
    this.tick().catch(() => {
      // ignore
    });
  }

  private async tick() {
    if (!this.running) return;
    if (this.inFlight) return;
    if (!BrainStore.getState().enabled) return;
    if (!AppSettings.getState().notifications) return;

    const alerts = BrainStore.getState().priceAlerts;
    if (!alerts.length) return;

    this.inFlight = true;
    try {
      const uniqueTokenIds = [...new Set(alerts.map((a) => a.tokenId))];
      const prices = await fetchPricesUsd(uniqueTokenIds);
      for (const alert of alerts) {
        const usd = prices.get(alert.tokenId);
        if (typeof usd !== "number") continue;
        await maybeTriggerAlert(alert, usd);
      }
    } finally {
      this.inFlight = false;
    }
  }
}

async function fetchPricesUsd(tokenIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  // This matches your existing usage in utils/wallet.ts (lite-api.jup.ag/price/v3?ids=...)
  // We batch by comma-separated list.
  const ids = tokenIds.map(encodeURIComponent).join(",");
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`);
  const json = await res.json();
  for (const id of tokenIds) {
    const row = json?.[id];
    const usd = row?.usdPrice;
    if (typeof usd === "number" && Number.isFinite(usd)) out.set(id, usd);
  }
  return out;
}

function shouldTrigger(alert: PriceAlert, usd: number) {
  if (alert.direction === "above") return usd >= alert.target;
  return usd <= alert.target;
}

async function maybeTriggerAlert(alert: PriceAlert, usd: number) {
  const now = Date.now();
  const cooldown = alert.cooldownMs ?? 30 * 60_000; // default 30m
  if (alert.lastTriggeredAt && now - alert.lastTriggeredAt < cooldown) return;
  if (!shouldTrigger(alert, usd)) return;

  BrainStore.getState().updatePriceAlert(alert.id, { lastTriggeredAt: now });

  const symbol = alert.tokenSymbol || alert.tokenId;
  const title = "Price alert";
  const body =
    alert.direction === "above"
      ? `${symbol} is above $${alert.target.toFixed(2)} (now $${usd.toFixed(2)})`
      : `${symbol} is below $${alert.target.toFixed(2)} (now $${usd.toFixed(2)})`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: { kind: "price_alert", alertId: alert.id, tokenId: alert.tokenId },
    },
    trigger: null,
  });

  if (alert.oneShot) {
    BrainStore.getState().removePriceAlert(alert.id);
  }
}

