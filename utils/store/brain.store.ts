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

export type BrainEventType =
  | "conversation.tool.status_changed"
  | "conversation.message.created"
  | "price.alert.triggered"
  | "app.opened"
  | string;

export interface BrainEventLogItem {
  id: string;
  type: BrainEventType;
  createdAt: number;
  /** short text summary for on-device digesting */
  summary: string;
  /** arbitrary data for local processing (never includes secrets) */
  data?: any;
  /** optional conversation linkage */
  conversationId?: string;
  messageId?: string;
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

  /** Rolling on-device event journal used to generate 12h digests */
  eventLog: BrainEventLogItem[];
  appendEvent: (e: BrainEventLogItem) => void;
  clearEventLog: () => void;

  /** Digest scheduling */
  lastDigestAt: number | null;
  setLastDigestAt: (ts: number | null) => void;
  digestIntervalMs: number;
  setDigestIntervalMs: (ms: number) => void;
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

      eventLog: [],
      appendEvent: (e) => set({ eventLog: [e, ...get().eventLog].slice(0, 500) }),
      clearEventLog: () => set({ eventLog: [] }),

      lastDigestAt: null,
      setLastDigestAt: (ts) => set({ lastDigestAt: ts }),
      digestIntervalMs: 12 * 60 * 60_000,
      setDigestIntervalMs: (ms) => set({ digestIntervalMs: Math.max(60_000, ms) }),
    }),
    {
      name: "brain",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default BrainStore;

