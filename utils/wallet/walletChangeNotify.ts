import * as Notifications from "expo-notifications";
import { AppState } from "react-native";
import AppSettings from "@/utils/store/settingsstore.store";
import type { userWalletType } from "@/utils/store/userstore.store";

/** Per-mint throttle so Helius / float jitter does not spam toasts while polling */
const MINT_NOTIFY_COOLDOWN_MS = 75_000;

const lastNotifyAtByMint = new Map<string, number>();

export function resetWalletChangeNotifyCooldowns(): void {
  lastNotifyAtByMint.clear();
}

function mintCooldownAllowsNotify(mint: string): boolean {
  const last = lastNotifyAtByMint.get(mint);
  const t = Date.now();
  if (last != null && t - last < MINT_NOTIFY_COOLDOWN_MS) return false;
  lastNotifyAtByMint.set(mint, t);
  return true;
}

/** Shallow clone so later store updates do not mutate the snapshot. */
export function snapshotUserWallet(w: userWalletType): userWalletType {
  return {
    balance: w.balance,
    solBalance: w.solBalance,
    totalUsdBalance: w.totalUsdBalance,
    tokenAccounts: w.tokenAccounts.map((t) => ({ ...t })),
  };
}

function label(t: { symbol?: string; name?: string; mint: string }): string {
  const s = (t.symbol && t.symbol.trim()) || (t.name && String(t.name).trim()) || "";
  if (s) return s;
  return `${t.mint.slice(0, 4)}…${t.mint.slice(-4)}`;
}

function minMeaningfulDelta(decimals: number | undefined): number {
  const d = Number.isFinite(decimals) ? Number(decimals) : 9;
  return Math.max(1e-12, Math.pow(10, -Math.min(Math.max(d, 0), 9)) * 5);
}

function formatAmount(n: number, decimals: number | undefined): string {
  const d = Number.isFinite(decimals) ? Number(decimals) : 9;
  const maxFrac = Math.min(8, Math.max(2, d));
  const s = n.toFixed(maxFrac).replace(/\.?0+$/, "");
  return s || "0";
}

export type WalletChangeKind = "new_asset" | "balance_increase";

export interface WalletChangeEvent {
  mint: string;
  decimals: number | undefined;
  kind: WalletChangeKind;
  symbolLabel: string;
  delta?: number;
}

export function collectWalletIncomingChanges(
  prev: userWalletType,
  next: userWalletType
): WalletChangeEvent[] {
  const events: WalletChangeEvent[] = [];
  const prevMap = new Map(prev.tokenAccounts.map((t) => [t.mint, t]));
  for (const t of next.tokenAccounts) {
    const p = prevMap.get(t.mint);
    const sym = label(t);
    if (!p) {
      if (t.balance > minMeaningfulDelta(t.decimals)) {
        events.push({
          mint: t.mint,
          decimals: t.decimals,
          kind: "new_asset",
          symbolLabel: sym,
        });
      }
      continue;
    }
    const minD = minMeaningfulDelta(t.decimals);
    if (t.balance > p.balance + minD) {
      events.push({
        mint: t.mint,
        decimals: t.decimals,
        kind: "balance_increase",
        symbolLabel: sym,
        delta: t.balance - p.balance,
      });
    }
  }
  return events;
}

/**
 * Toast + optional local notification when incoming balance / new asset detected.
 * Ignores decreases (sends). Caller should skip the first authoritative load (see dashboard priming).
 */
export function notifyWalletSnapshotChanges(
  prev: userWalletType,
  next: userWalletType
): void {
  const raw = collectWalletIncomingChanges(prev, next);
  const filtered = raw.filter((e) => mintCooldownAllowsNotify(e.mint));
  if (filtered.length === 0) return;

  const lines = filtered.map((e) =>
    e.kind === "new_asset"
      ? `New asset: ${e.symbolLabel}`
      : `Received +${formatAmount(e.delta ?? 0, e.decimals)} ${e.symbolLabel}`
  );
  const toastBody =
    filtered.length === 1
      ? lines[0]!
      : `${lines[0]} (+${filtered.length - 1} more)`;

  if (AppState.currentState === "active") {
    AppSettings.getState().setToast(toastBody, "success");
  }

  if (AppSettings.getState().notifications) {
    const body =
      filtered.length === 1
        ? lines[0]!
        : `${filtered.length} updates — ${lines[0]}`;
    void Notifications.scheduleNotificationAsync({
      content: {
        title: "Wallet activity",
        body: body.slice(0, 200),
        sound: "default",
        data: { kind: "wallet_balance", mints: filtered.map((e) => e.mint) },
      },
      trigger: null,
    }).catch(() => {});
  }
}
