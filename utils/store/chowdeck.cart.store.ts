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

interface ChowdeckCartStore {
  location: ChowdeckCartLocation | null;
  vendor: ChowdeckCartVendor | null;
  lines: ChowdeckCartLine[];
  setLocation: (location: ChowdeckCartLocation | null) => void;
  setVendor: (vendor: ChowdeckCartVendor | null) => void;
  addLine: (line: ChowdeckCartLine) => { ok: boolean; message?: string };
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
    if (current && vendor && current.id !== vendor.id && get().lines.length > 0) {
      set({ vendor, lines: [] });
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
    set((state) => ({ lines: [...state.lines, nextLine] }));
    return { ok: true };
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
