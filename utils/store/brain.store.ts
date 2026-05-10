import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";

export type BrainSuggestionType =
  | "trade"
  | "price_alert"
  | "reminder"
  | "security"
  | "insight"
  | "generic";

export interface BrainSuggestion {
  id: string;
  type: BrainSuggestionType;
  title: string;
  body: string;
  createdAt: number;
  /** Optional deep link or in-app route */
  link?: string;
  /** Used to suppress duplicates */
  dedupeKey?: string;
  /** Optional metadata payload for later action */
  data?: any;
}

export type PriceAlertDirection = "above" | "below";

export interface PriceAlert {
  id: string;
  /** Jupiter price endpoint token id (mint or symbol depending on endpoint usage) */
  tokenId: string;
  tokenSymbol?: string;
  currency: "USD";
  direction: PriceAlertDirection;
  target: number;
  createdAt: number;
  lastTriggeredAt?: number;
  /** If true, remove after first trigger */
  oneShot?: boolean;
  /** Minimum time between triggers for the same alert */
  cooldownMs?: number;
}

export interface BrainReminder {
  id: string;
  title: string;
  body?: string;
  dueAt: number;
  createdAt: number;
  /** expo-notifications identifier when scheduled */
  notificationId?: string;
}

interface BrainState {
  /** Whether the brain is allowed to run background-ish tasks while app is active */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;

  pollIntervalMs: number;
  setPollIntervalMs: (ms: number) => void;

  suggestions: BrainSuggestion[];
  addSuggestion: (s: BrainSuggestion) => void;
  dismissSuggestion: (id: string) => void;
  clearSuggestions: () => void;

  priceAlerts: PriceAlert[];
  addPriceAlert: (a: PriceAlert) => void;
  removePriceAlert: (id: string) => void;
  updatePriceAlert: (id: string, patch: Partial<PriceAlert>) => void;

  reminders: BrainReminder[];
  addReminder: (r: BrainReminder) => void;
  removeReminder: (id: string) => void;
  updateReminder: (id: string, patch: Partial<BrainReminder>) => void;
}

const BrainStore = create(
  persist<BrainState>(
    (set, get) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),

      pollIntervalMs: 60_000,
      setPollIntervalMs: (ms) => set({ pollIntervalMs: Math.max(10_000, ms) }),

      suggestions: [],
      addSuggestion: (s) => {
        const existing = s.dedupeKey
          ? get().suggestions.find((x) => x.dedupeKey === s.dedupeKey)
          : null;
        if (existing) return;
        set({ suggestions: [s, ...get().suggestions].slice(0, 50) });
      },
      dismissSuggestion: (id) =>
        set({ suggestions: get().suggestions.filter((s) => s.id !== id) }),
      clearSuggestions: () => set({ suggestions: [] }),

      priceAlerts: [],
      addPriceAlert: (a) => set({ priceAlerts: [a, ...get().priceAlerts] }),
      removePriceAlert: (id) =>
        set({ priceAlerts: get().priceAlerts.filter((a) => a.id !== id) }),
      updatePriceAlert: (id, patch) =>
        set({
          priceAlerts: get().priceAlerts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }),

      reminders: [],
      addReminder: (r) => set({ reminders: [r, ...get().reminders] }),
      removeReminder: (id) =>
        set({ reminders: get().reminders.filter((r) => r.id !== id) }),
      updateReminder: (id, patch) =>
        set({
          reminders: get().reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }),
    }),
    {
      name: "brain",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default BrainStore;

