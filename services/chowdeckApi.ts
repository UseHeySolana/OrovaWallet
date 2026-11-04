import { BASE_URL } from "@/utils/constant";

export interface ChowdeckPlacePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

export interface ChowdeckPlaceDetails {
  place_id: string;
  formatted_address: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  vicinity?: string | null;
}

export interface ChowdeckVendor {
  id: number;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  location?: string | null;
  average_rating?: string | number | null;
  is_open: boolean;
  distance?: number | null;
  delivery_price_ngn: number;
  minimum_order_amount_ngn: number;
  minimum_delivery_time?: number | null;
  maximum_delivery_time?: number | null;
  currency?: string;
}

export interface ChowdeckProduct {
  id: number;
  menu_id: number;
  vendor_id: number;
  vendor_name: string;
  name: string;
  description?: string | null;
  in_stock: boolean;
  price_kobo: number;
  price_ngn: number;
  currency: string;
  image?: string | null;
  delivery_price_ngn: number;
  minimum_order_amount_ngn: number;
  is_vendor_open: boolean;
  average_rating?: string | number | null;
}

export interface ChowdeckModifierOption {
  id: number;
  name: string;
  price_kobo: number;
  price_ngn: number;
  in_stock: boolean;
  is_active: boolean;
  currency: string;
}

export interface ChowdeckModifierGroup {
  id: number;
  name: string;
  minimum_selection: number;
  maximum_selection: number;
  items: ChowdeckModifierOption[];
}

export interface ChowdeckMenuItem {
  id: number;
  menu_id: number;
  vendor_id: number;
  name: string;
  description?: string | null;
  in_stock: boolean;
  is_active: boolean;
  price_kobo: number;
  price_ngn: number;
  currency: string;
  price_description?: string | null;
  category?: { id?: number; name?: string } | null;
  modifiers: ChowdeckModifierGroup[];
  images?: { id?: number; path: string; rank?: number }[];
  image?: string | null;
}

export interface ChowdeckMenuCategory {
  id: number;
  name: string;
  is_published: boolean;
  food_count: number;
  rank?: number | null;
}

export interface ChowdeckVendorMenuItem {
  id: number;
  menu_id: number;
  vendor_id: number;
  name: string;
  description?: string | null;
  in_stock: boolean;
  price_kobo: number;
  price_ngn: number;
  currency: string;
  price_description?: string | null;
  category?: { id: number; name: string } | null;
  category_name?: string;
  image?: string | null;
  average_rating?: string | number | null;
}

export interface ChowdeckOrderModifier {
  group_id: number;
  group_name?: string;
  option_id: number;
  option_name: string;
  price_ngn: number;
}

export interface ChowdeckOrderItemPayload {
  menu_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  product_image_url?: string;
  modifiers?: ChowdeckOrderModifier[];
}

export interface ChowdeckDeliveryPayload {
  place_id: string;
  formatted_address: string;
  latitude?: number | null;
  longitude?: number | null;
  phone_number: string;
  customer_name?: string;
}

export interface PlaceChowdeckOrderResult {
  order_number: string;
  id: number;
  total_amount_ngn?: number;
  amount_usd?: number | null;
}

async function getJson(path: string) {
  const res = await fetch(BASE_URL + path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || `Request failed: ${res.status}`);
  }
  return data;
}

async function postJson(path: string, body: object) {
  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { message?: string })?.message || "Request failed";
    const errList = (data as { errors?: Record<string, string[]> })?.errors
      ? Object.entries((data as { errors: Record<string, string[]> }).errors).flatMap(([k, v]) =>
          (Array.isArray(v) ? v : [v]).map((e) => `${k}: ${e}`)
        )
      : [];
    const serverErr = (data as { error?: string })?.error ? ` ${(data as { error: string }).error}` : "";
    throw new Error([errList.length ? `${msg} (${errList.join("; ")})` : msg, serverErr].filter(Boolean).join(".").trim());
  }
  return data;
}

/** Chowdeck often returns many rows with the same label but different place_ids. */
export function dedupeChowdeckPredictions(
  predictions: ChowdeckPlacePrediction[]
): ChowdeckPlacePrediction[] {
  const seen = new Set<string>();
  const out: ChowdeckPlacePrediction[] = [];
  for (const p of predictions) {
    if (!p?.place_id) continue;
    const label = (
      p.description ||
      [p.structured_formatting?.main_text, p.structured_formatting?.secondary_text]
        .filter(Boolean)
        .join(", ") ||
      p.place_id
    )
      .trim()
      .toLowerCase();
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(p);
  }
  return out;
}

export async function autocompleteChowdeckPlace(input: string): Promise<ChowdeckPlacePrediction[]> {
  const data = await getJson(`/chowdeck/place/autocomplete?input=${encodeURIComponent(input)}`);
  const raw = ((data as { data?: ChowdeckPlacePrediction[] }).data ?? []) as ChowdeckPlacePrediction[];
  return dedupeChowdeckPredictions(raw);
}

export async function getChowdeckPlaceDetails(placeId: string): Promise<ChowdeckPlaceDetails> {
  const data = await getJson(`/chowdeck/place/details?place_id=${encodeURIComponent(placeId)}`);
  return (data as { data: ChowdeckPlaceDetails }).data;
}

export async function reverseGeocodeChowdeckPlace(
  latitude: number,
  longitude: number,
  addressHint?: string
): Promise<ChowdeckPlaceDetails> {
  const qs = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  if (addressHint) {
    qs.append("address_hint", addressHint);
  }
  const data = await getJson(`/chowdeck/place/reverse?${qs.toString()}`);
  return (data as { data: ChowdeckPlaceDetails }).data;
}

export async function searchChowdeckFood(
  addressId: string,
  query: string
): Promise<{ vendors: ChowdeckVendor[]; products: ChowdeckProduct[] }> {
  const data = await getJson(
    `/chowdeck/search?address_id=${encodeURIComponent(addressId)}&query=${encodeURIComponent(query)}`
  );
  const nested = (data as { data?: { vendors?: ChowdeckVendor[]; products?: ChowdeckProduct[] } }).data;
  return {
    vendors: nested?.vendors ?? [],
    products: nested?.products ?? [],
  };
}

export async function getChowdeckMenuCategories(vendorId: number): Promise<ChowdeckMenuCategory[]> {
  const data = await getJson(`/chowdeck/vendors/${vendorId}/menu-categories`);
  return ((data as { data?: ChowdeckMenuCategory[] }).data ?? []) as ChowdeckMenuCategory[];
}

export async function getChowdeckVendorMenu(
  vendorId: number,
  options?: { query?: string; category?: string; returnOutOfStock?: boolean }
): Promise<{
  vendor_id: number;
  items: ChowdeckVendorMenuItem[];
  categories: { id: number; name: string; food_count: number }[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (options?.query?.trim()) params.set("query", options.query.trim());
  if (options?.category?.trim()) params.set("category", options.category.trim());
  if (options?.returnOutOfStock === false) params.set("return_out_of_stock", "0");
  const qs = params.toString();
  const data = await getJson(
    `/chowdeck/vendors/${vendorId}/menu${qs ? `?${qs}` : ""}`
  );
  const nested = (data as {
    data?: {
      vendor_id?: number;
      items?: ChowdeckVendorMenuItem[];
      categories?: { id: number; name: string; food_count: number }[];
      total?: number;
    };
  }).data;
  return {
    vendor_id: nested?.vendor_id ?? vendorId,
    items: nested?.items ?? [],
    categories: nested?.categories ?? [],
    total: nested?.total ?? (nested?.items?.length ?? 0),
  };
}

export async function getChowdeckMenuItem(vendorId: number, menuId: number): Promise<ChowdeckMenuItem> {
  const data = await getJson(`/chowdeck/vendors/${vendorId}/menus/${menuId}`);
  return (data as { data: ChowdeckMenuItem }).data;
}

export async function placeChowdeckOrder(
  walletAddress: string,
  payload: {
    vendor_id: number;
    vendor_name?: string;
    delivery: ChowdeckDeliveryPayload;
    delivery_fee_ngn?: number;
    items: ChowdeckOrderItemPayload[];
    payment_method?: string;
    notes?: string;
    delivery_instructions?: string;
  }
): Promise<PlaceChowdeckOrderResult> {
  const data = await postJson("/chowdeck/wallet/orders", {
    wallet_address: walletAddress,
    ...payload,
  });
  const order = (data as {
    data?: { order_number?: string; id?: number; total_amount_ngn?: number; amount_usd?: number | null };
  }).data;
  return {
    order_number: order?.order_number ?? "",
    id: order?.id ?? 0,
    total_amount_ngn: order?.total_amount_ngn,
    amount_usd: order?.amount_usd ?? null,
  };
}

export async function markChowdeckOrderPaid(
  walletAddress: string,
  payload: {
    order_number: string;
    transaction_signature?: string;
    payment_method?: string;
  }
): Promise<boolean> {
  try {
    await postJson("/chowdeck/wallet/orders/mark-paid", {
      wallet_address: walletAddress,
      ...payload,
    });
    return true;
  } catch {
    return false;
  }
}
