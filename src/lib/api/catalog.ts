import { API_URL, apiFetch } from "./client";

export type ApiVariant = {
  id: number;
  sku: string;
  name: string;
  accountType: string | null;
  duration: string | null;
  durationDays: number | null;
  price: number;
  regularPrice: number | null;
  stockStatus: "in_stock" | "out_of_stock" | "backorder";
  deliveryType: "auto" | "manual";
  isEnabled: boolean;
  sortOrder: number;
};

export type ApiCategory = {
  id: number;
  name: string;
  slug: string;
  path: string;
  icon: string | null;
  parentId: number | null;
  description?: string | null;
  contentHtml?: string | null;
  imageUrl?: string | null;
  children?: ApiCategory[];
};

export type ApiProduct = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  contentHtml?: string | null;
  featuredImage: string | null;
  badges: string[] | null;
  status: "draft" | "active" | "hidden";
  ratingAverage: number;
  reviewCount: number;
  soldCount: number;
  warrantyDays: number | null;
  deliveryTimeText: string | null;
  variants: ApiVariant[];
  categories: ApiCategory[];
  images?: { src: string; alt: string | null }[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ListProductsParams = {
  category?: string;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "best_selling" | "featured";
  badge?: string;
  slugs?: string[];
  ids?: number[];
  page?: number;
  limit?: number;
};

export function buildQuery(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type ApiReview = {
  id: number;
  authorName: string;
  rating: number;
  content: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type ReviewsPage = Paginated<ApiReview> & {
  summary: { ratingAverage: number; reviewCount: number };
};

export const catalogApi = {
  listProducts: (params: ListProductsParams = {}) =>
    apiFetch<Paginated<ApiProduct>>(`/products${buildQuery(params)}`, { auth: false }),

  getProduct: (slug: string) =>
    apiFetch<ApiProduct>(`/products/${encodeURIComponent(slug)}`, { auth: false }),

  getCategories: () => apiFetch<ApiCategory[]>("/categories", { auth: false }),

  listReviews: (slug: string, params: { page?: number; limit?: number; rating?: number } = {}) =>
    apiFetch<ReviewsPage>(`/products/${encodeURIComponent(slug)}/reviews${buildQuery(params)}`, {
      auth: false,
    }),

  /** Attaches the session when signed in so the review links to the account. */
  createReview: (slug: string, input: { authorName: string; rating: number; content: string }) =>
    apiFetch<ApiReview>(`/products/${encodeURIComponent(slug)}/reviews`, {
      method: "POST",
      body: input,
    }),
};

/**
 * Server-side helper: resolves products for a list of slugs (keeps the given order).
 * Always fresh and resilient — returns an empty map when the API is down.
 */
export async function fetchProductsBySlugs(slugs: string[]) {
  const map = new Map<string, ApiProduct>();
  const unique = [...new Set(slugs)].filter(Boolean);
  if (!unique.length) return map;

  try {
    const response = await fetch(
      `${API_URL}/products${buildQuery({ slugs: unique, limit: Math.min(100, unique.length) })}`,
      { cache: "no-store" },
    );
    if (!response.ok) return map;
    const data = (await response.json()) as Paginated<ApiProduct>;
    for (const product of data.items) {
      map.set(product.slug, product);
    }
  } catch {
    // API offline – sections render empty.
  }
  return map;
}
