import { create } from "zustand";

const MAX_ENTRIES = 80;
const MAX_BODY_CHARS = 24_000;

export type DevNetworkLogEntry = {
    id: string;
    at: number;
    /** Short title for the list row */
    label: string;
    method: string;
    url: string;
    status: number;
    durationMs: number;
    requestSummary?: string;
    /** Truncated response body (often JSON; may be plain text on errors) */
    responseBody: string;
};

interface DevNetworkLogState {
    entries: DevNetworkLogEntry[];
    append: (entry: Omit<DevNetworkLogEntry, "id" | "at">) => void;
    clear: () => void;
}

export const useDevNetworkLogStore = create<DevNetworkLogState>((set, get) => ({
    entries: [],
    append(entry) {
        if (!__DEV__) return;
        const row: DevNetworkLogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            at: Date.now(),
            ...entry,
            responseBody: entry.responseBody.slice(0, MAX_BODY_CHARS),
        };
        set({ entries: [row, ...get().entries].slice(0, MAX_ENTRIES) });
    },
    clear() {
        if (!__DEV__) return;
        set({ entries: [] });
    },
}));

/** Imperative log from non-React modules (only records when `__DEV__`). */
export function pushDevNetworkLog(entry: Omit<DevNetworkLogEntry, "id" | "at">) {
    if (!__DEV__) return;
    useDevNetworkLogStore.getState().append(entry);
}
