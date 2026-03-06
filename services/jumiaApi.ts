import { BASE_URL } from "@/utils/constant";

export interface JumiaProduct {
  name: string;
  price: { current: number; original: number; currency: string };
  image?: string;
  rating?: number;
  link?: string;
  url?: string;
  availability?: boolean;
}

export interface JumiaProductDetails {
  name: string;
  brand: string;
  price: { current: number; original: number; currency: string };
  images: string[];
  rating?: number;
  link?: string;
  url?: string;
  shipping?: string;
  availability?: boolean;
}

export interface JumiaDeliveryAddress {
  id: number;
  full_name: string;
  phone_number: string;
  email?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default?: boolean;
  landmark?: string;
  additional_instructions?: string;
}

export interface JumiaCartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  product_image_url?: string;
  product_url?: string;
  category?: string;
  brand?: string;
}

async function postJson(body: object, path: string) {
  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

async function get(path: string) {
  const res = await fetch(BASE_URL + path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return res;
}

export async function searchJumiaProducts(query: string, options?: { page?: number; limit?: number }): Promise<JumiaProduct[]> {
  const res = await postJson(
    { query, limit: options?.limit ?? 20 },
    "/jumia/scrape/search"
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error || `Search failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getJumiaDeliveryAddresses(walletAddress: string): Promise<JumiaDeliveryAddress[]> {
  const res = await get(`/jumia/wallet/delivery-addresses?wallet_address=${encodeURIComponent(walletAddress)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string })?.message || "Failed to load addresses");
  }
  const json = await res.json();
  return (json as { data?: JumiaDeliveryAddress[] }).data ?? [];
}

export async function createJumiaDeliveryAddress(
  walletAddress: string,
  address: Omit<JumiaDeliveryAddress, "id">
): Promise<JumiaDeliveryAddress> {
  const res = await postJson(
    { wallet_address: walletAddress, ...address },
    "/jumia/wallet/delivery-addresses"
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to create address");
  }
  return (data as { data: JumiaDeliveryAddress }).data;
}

export interface JumiaInlineAddress {
  full_name: string;
  phone_number: string;
  email?: string;
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface PlaceJumiaOrderResult {
  order_number: string;
  id: number;
  total_amount_ngn?: number;
  /** USD amount to charge (NGN converted + processing fee). Use for USDC deduction. */
  amount_usd?: number | null;
}

export async function placeJumiaOrder(
  walletAddress: string,
  payload: {
    delivery_address_id?: number;
    delivery_address?: JumiaInlineAddress;
    items: JumiaCartItem[];
    payment_method?: string;
    notes?: string;
    is_express_delivery?: boolean;
    delivery_instructions?: string;
  }
): Promise<PlaceJumiaOrderResult> {
  const res = await postJson(
    { wallet_address: walletAddress, ...payload },
    "/jumia/wallet/orders"
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to place order");
  }
  const order = (data as { data?: { order_number?: string; id?: number; total_amount_ngn?: number; amount_usd?: number | null } }).data;
  return {
    order_number: order?.order_number ?? "",
    id: order?.id ?? 0,
    total_amount_ngn: order?.total_amount_ngn,
    amount_usd: order?.amount_usd ?? null,
  };
}


export async function getJumiaProductDetails(productLink: string): Promise<JumiaProductDetails> {
  const res = await postJson(
    { product_link: productLink },
    "/jumia/scrape/product-details"
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error || `Product details failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    name: data.name,
    brand: data.brand,
    price: {
      current: data.price?.current ?? 0,
      original: data.price?.original ?? 0,
      currency: data.price?.currency ?? "NGN",
    },
    images: Array.isArray(data.images) ? data.images : [],
    rating: data.rating,
    link: data.link ?? data.url,
    url: data.url ?? data.link,
    shipping: data.shipping,
    availability: data.availability,
  };
}