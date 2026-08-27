import { create } from "zustand";

export interface ChowdeckCartLocation {
  place_id: string;
  formatted_address: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ChowdeckCartVendor {
  id: number;
  name: string;
  delivery_price_ngn: number;
  minimum_order_ngn: number;
}

export interface ChowdeckCartModifier {
  group_id: number;
  group_name?: string;
  option_id: number;
  option_name: string;
  price_ngn: number;
}

export interface ChowdeckCartLine {
  menuId: number;
  name: string;
  qty: number;
  unitPriceNgn: number;
  modifiers: ChowdeckCartModifier[];
  image?: string | null;
}

function modifiersKey(modifiers: ChowdeckCartModifier[] = []): string {
  return [...modifiers]
    .map((m) => `${m.group_id}:${m.option_id}`)
    .sort()
    .join("|");
}

function linesMatch(a: ChowdeckCartLine, b: Pick<ChowdeckCartLine, "menuId" | "modifiers">): boolean {
  return a.menuId === b.menuId && modifiersKey(a.modifiers) === modifiersKey(b.modifiers ?? []);
}

interface ChowdeckCartStore {
  location: ChowdeckCartLocation | null;
  vendor: ChowdeckCartVendor | null;
  lines: ChowdeckCartLine[];
  setLocation: (location: ChowdeckCartLocation | null) => void;
  setVendor: (vendor: ChowdeckCartVendor | null) => void;
  addLine: (line: ChowdeckCartLine) => { ok: boolean; message?: string };
  /** Set qty on matching line(s). productName matches case-insensitively (partial OK). */
  setQuantity: (args: {
    quantity: number;
    menuId?: number;
    productName?: string;
    /** When true (default if no item filter), set every line to this qty — e.g. "3 packs". */
    allItems?: boolean;
  }) => { ok: boolean; message?: string; updated?: number };
  removeLine: (menuId: number, index?: number) => void;
  clearLines: () => void;
  clear: () => void;
  subtotal: () => number;
  deliveryFee: () => number;
  total: () => number;
  meetsMinimum: () => boolean;
  lineCount: () => number;
}

const ChowdeckCart = create<ChowdeckCartStore>((set, get) => ({
  location: null,
  vendor: null,
  lines: [],

  setLocation: (location) => set({ location }),

  setVendor: (vendor) => {
    const current = get().vendor;
    // Chowdeck carts are single-restaurant. Never silently wipe lines when switching.
    if (current && vendor && current.id !== vendor.id && get().lines.length > 0) {
      return;
    }
    set({ vendor });
  },

  addLine: (line) => {
    const vendor = get().vendor;
    if (!vendor) {
      return { ok: false, message: "Select a vendor before adding items to the cart." };
    }
    const modifiersTotal = (line.modifiers ?? []).reduce((sum, m) => sum + (Number(m.price_ngn) || 0), 0);
    const unitPriceNgn = Number(line.unitPriceNgn) + modifiersTotal;
    const nextLine: ChowdeckCartLine = {
      ...line,
      qty: Math.max(1, Math.floor(line.qty || 1)),
      unitPriceNgn,
      modifiers: line.modifiers ?? [],
    };
    set((state) => {
      const existingIdx = state.lines.findIndex((l) => linesMatch(l, nextLine));
      if (existingIdx >= 0) {
        const lines = state.lines.map((l, i) =>
          i === existingIdx ? { ...l, qty: l.qty + nextLine.qty } : l
        );
        return { lines };
      }
      return { lines: [...state.lines, nextLine] };
    });
    return { ok: true };
  },

  setQuantity: ({ quantity, menuId, productName, allItems }) => {
    const qty = Math.max(1, Math.floor(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return { ok: false, message: "Quantity must be at least 1." };
    }
    const lines = get().lines;
    if (lines.length === 0) {
      return { ok: false, message: "Cart is empty." };
    }

    const nameNeedle = productName?.trim().toLowerCase();
    const hasItemFilter = menuId != null || Boolean(nameNeedle);
    const applyAll = allItems === true || !hasItemFilter;

    let updated = 0;
    const next = lines.map((line) => {
      if (applyAll) {
        updated += 1;
        return { ...line, qty };
      }
      const menuOk = menuId == null || line.menuId === menuId;
      const nameOk =
        !nameNeedle ||
        line.name.toLowerCase().includes(nameNeedle) ||
        nameNeedle.includes(line.name.toLowerCase());
      if (menuOk && nameOk) {
        updated += 1;
        return { ...line, qty };
      }
      return line;
    });

    if (updated === 0) {
      return {
        ok: false,
        message: nameNeedle
          ? `No cart item matched "${productName}".`
          : "No matching cart item to update.",
      };
    }

    set({ lines: next });
    return { ok: true, updated };
  },

  removeLine: (menuId, index) => {
    set((state) => {
      if (typeof index === "number") {
        return { lines: state.lines.filter((_, i) => i !== index) };
      }
      return { lines: state.lines.filter((l) => l.menuId !== menuId) };
    });
  },

  clearLines: () => set({ lines: [] }),

  clear: () => set({ location: null, vendor: null, lines: [] }),

  subtotal: () =>
    get().lines.reduce((sum, line) => sum + line.unitPriceNgn * line.qty, 0),

  deliveryFee: () => get().vendor?.delivery_price_ngn ?? 0,

  total: () => get().subtotal() + get().deliveryFee(),

  meetsMinimum: () => {
    const min = get().vendor?.minimum_order_ngn ?? 0;
    if (min <= 0) return true;
    return get().subtotal() >= min;
  },

  lineCount: () => get().lines.reduce((sum, l) => sum + l.qty, 0),
}));

export default ChowdeckCart;
