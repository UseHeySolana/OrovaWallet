import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  AppTransactionCluster,
  RecordAppTransactionPayload,
} from "@/services/appTransactions";

export type OutboxSyncStatus = "pending_sync" | "synced";

export interface AppTransactionOutboxEntry {
  localId: string;
  dedupKey: string;
  payload: RecordAppTransactionPayload;
  sync_status: OutboxSyncStatus;
  remote_id?: number;
  created_at: string;
  updated_at: string;
  sync_attempts: number;
  last_sync_error?: string;
}

interface AppTransactionOutboxState {
  entries: Record<string, AppTransactionOutboxEntry>;
  upsert: (payload: RecordAppTransactionPayload) => string;
  markSynced: (localId: string, remoteId?: number) => void;
  markSyncFailed: (localId: string, error?: string) => void;
  getByLocalId: (localId: string) => AppTransactionOutboxEntry | undefined;
  getPending: () => AppTransactionOutboxEntry[];
  getForWallet: (
    walletAddress: string,
    cluster: AppTransactionCluster
  ) => AppTransactionOutboxEntry[];
}

function nowIso() {
  return new Date().toISOString();
}

function randomLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function outboxDedupKey(payload: RecordAppTransactionPayload): string | null {
  if (payload.client_reference?.trim()) {
    return `ref:${payload.client_reference.trim()}`;
  }
  if (payload.signature?.trim()) {
    const cluster = payload.cluster ?? "mainnet";
    return `sig:${cluster}:${payload.signature.trim()}`;
  }
  return null;
}

const AppTransactionOutbox = create<AppTransactionOutboxState>()(
  persist(
    (set, get) => ({
      entries: {},

      upsert: (payload) => {
        const dedupKey = outboxDedupKey(payload);
        const timestamp = nowIso();
        const existing = dedupKey
          ? Object.values(get().entries).find((entry) => entry.dedupKey === dedupKey)
          : undefined;

        if (existing) {
          const payloadChanged =
            JSON.stringify(existing.payload) !== JSON.stringify(payload);
          const next: AppTransactionOutboxEntry = {
            ...existing,
            payload,
            updated_at: timestamp,
            sync_status:
              existing.sync_status === "synced" && !payloadChanged
                ? "synced"
                : "pending_sync",
          };
          set((state) => ({
            entries: { ...state.entries, [existing.localId]: next },
          }));
          return existing.localId;
        }

        const localId = randomLocalId();
        const entry: AppTransactionOutboxEntry = {
          localId,
          dedupKey: dedupKey ?? `id:${localId}`,
          payload,
          sync_status: "pending_sync",
          created_at: timestamp,
          updated_at: timestamp,
          sync_attempts: 0,
        };

        set((state) => ({
          entries: { ...state.entries, [localId]: entry },
        }));
        return localId;
      },

      markSynced: (localId, remoteId) => {
        const existing = get().entries[localId];
        if (!existing) return;
        set((state) => ({
          entries: {
            ...state.entries,
            [localId]: {
              ...existing,
              sync_status: "synced",
              remote_id: remoteId ?? existing.remote_id,
              updated_at: nowIso(),
              last_sync_error: undefined,
            },
          },
        }));
      },

      markSyncFailed: (localId, error) => {
        const existing = get().entries[localId];
        if (!existing) return;
        set((state) => ({
          entries: {
            ...state.entries,
            [localId]: {
              ...existing,
              sync_status: "pending_sync",
              sync_attempts: existing.sync_attempts + 1,
              updated_at: nowIso(),
              last_sync_error: error,
            },
          },
        }));
      },

      getByLocalId: (localId) => get().entries[localId],

      getPending: () =>
        Object.values(get().entries).filter(
          (entry) => entry.sync_status === "pending_sync"
        ),

      getForWallet: (walletAddress, cluster) =>
        Object.values(get().entries).filter((entry) => {
          const wallet = entry.payload.wallet_address ?? "";
          const entryCluster = entry.payload.cluster ?? "mainnet";
          return wallet === walletAddress && entryCluster === cluster;
        }),
    }),
    {
      name: "app-transaction-outbox",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);

export default AppTransactionOutbox;
