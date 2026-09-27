import { buildQuery, type Paginated } from "./catalog";
import { apiFetch } from "./client";

export type ApiPostCategory = { id: number; name: string; slug: string };

export type ApiPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml?: string | null;
  featuredImage: string | null;
  publishedAt: string | null;
  updatedAt: string;
  viewCount: number;
  readingMinutes?: number;
  categories: ApiPostCategory[];
};

export type ApiPage = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string | null;
  featuredImage: string | null;
  template: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type ApiContentBlock = {
  id: number;
  title: string;
  type: "banner" | "announcement" | "help_article";
  placement: string;
  body: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
};

/** Common shape the article/about templates render (a post or a static page). */
export type ContentDoc = {
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string | null;
  featuredImage: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export function toContentDoc(item: ApiPost | ApiPage): ContentDoc {
  return {
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    contentHtml: item.contentHtml ?? null,
    featuredImage: item.featuredImage,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
  };
}

export const contentApi = {
  listPosts: (params: { page?: number; limit?: number; category?: string; search?: string } = {}) =>
    apiFetch<Paginated<ApiPost>>(`/posts${buildQuery(params)}`, { auth: false }),
  getPost: (slug: string) => apiFetch<ApiPost>(`/posts/${encodeURIComponent(slug)}`, { auth: false }),
  getPage: (slug: string) => apiFetch<ApiPage>(`/pages/${encodeURIComponent(slug)}`, { auth: false }),
  listBlocks: (placement: string) =>
    apiFetch<ApiContentBlock[]>(`/content-blocks/${encodeURIComponent(placement)}`, { auth: false }),
};
