import { BASE_URL } from "@/utils/constant";

export interface AppEngagementStats {
  ratings: number;
  user_count: number;
  review_count: number;
}

export interface AppReviewItem {
  id: number;
  app_slug?: string;
  rating: number;
  review?: string | null;
  user_name: string;
  user_image?: string | null;
  wallet_address?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AppIdentityPayload {
  wallet_address?: string;
  phone_number?: string;
  email?: string;
  user_name?: string;
  user_image?: string;
}

function identityQuery(identity: AppIdentityPayload): string {
  const params = new URLSearchParams();
  if (identity.wallet_address) params.set("wallet_address", identity.wallet_address);
  if (identity.phone_number) params.set("phone_number", identity.phone_number);
  if (identity.email) params.set("email", identity.email);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function parseJson(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}

export async function recordAppInstall(
  slug: string,
  identity: AppIdentityPayload
): Promise<AppEngagementStats | null> {
  if (!BASE_URL || !slug) return null;
  try {
    const res = await fetch(`${BASE_URL}/apps/${encodeURIComponent(slug)}/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identity),
    });
    const json = await parseJson(res);
    if (!res.ok) return null;
    return (json?.data?.engagement as AppEngagementStats) ?? null;
  } catch {
    return null;
  }
}

export async function recordAppUninstall(
  slug: string,
  identity: AppIdentityPayload
): Promise<AppEngagementStats | null> {
  if (!BASE_URL || !slug) return null;
  try {
    const res = await fetch(`${BASE_URL}/apps/${encodeURIComponent(slug)}/uninstall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identity),
    });
    const json = await parseJson(res);
    if (!res.ok) return null;
    return (json?.data?.engagement as AppEngagementStats) ?? null;
  } catch {
    return null;
  }
}

export async function fetchAppReviews(
  slug: string,
  identity?: AppIdentityPayload
): Promise<{
  reviews: AppReviewItem[];
  mine: AppReviewItem | null;
  engagement: AppEngagementStats | null;
}> {
  if (!BASE_URL || !slug) {
    return { reviews: [], mine: null, engagement: null };
  }
  try {
    const qs = identity ? identityQuery(identity) : "";
    const res = await fetch(
      `${BASE_URL}/apps/${encodeURIComponent(slug)}/reviews${qs}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
    const json = await parseJson(res);
    if (!res.ok) {
      return { reviews: [], mine: null, engagement: null };
    }
    return {
      reviews: Array.isArray(json.data) ? json.data : [],
      mine: json.mine ?? null,
      engagement: (json.engagement as AppEngagementStats) ?? null,
    };
  } catch {
    return { reviews: [], mine: null, engagement: null };
  }
}

export async function submitAppReview(
  slug: string,
  payload: AppIdentityPayload & { rating: number; review?: string }
): Promise<{
  review: AppReviewItem | null;
  engagement: AppEngagementStats | null;
  error?: string;
}> {
  if (!BASE_URL || !slug) {
    return { review: null, engagement: null, error: "API not configured" };
  }
  try {
    const res = await fetch(`${BASE_URL}/apps/${encodeURIComponent(slug)}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await parseJson(res);
    if (!res.ok) {
      return {
        review: null,
        engagement: null,
        error: json?.message || "Failed to submit review",
      };
    }
    return {
      review: json?.data?.review ?? null,
      engagement: json?.data?.engagement ?? null,
    };
  } catch {
    return { review: null, engagement: null, error: "Failed to submit review" };
  }
}

export function formatUserCount(count: number): string {
  if (!count || count < 1) return "0 users";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, "")}M+ users`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K+ users`;
  if (count >= 100) return `${count}+ users`;
  return count === 1 ? "1 user" : `${count} users`;
}

export function formatRating(rating: number): string {
  const n = Number(rating) || 0;
  return `${n.toFixed(1)} rating`;
}
