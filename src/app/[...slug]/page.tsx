import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutTemplate } from "@/components/wp/about-template";
import { ArticleTemplate } from "@/components/wp/article-template";
import { CategoryTemplate } from "@/components/wp/category-template";
import { ProductTemplate } from "@/components/wp/product-template";
import { buildQuery, type ApiCategory, type ApiProduct, type Paginated } from "@/lib/api/catalog";
import { toContentDoc, type ApiPage, type ApiPost } from "@/lib/api/content";
import { serverFetch } from "@/lib/api/server";
import { replaceBrandText } from "@/lib/brand";
import { apiProductToCommerce } from "@/lib/commerce-mapping";

/** Catalog/content URLs always resolve against the latest API data. */
export const dynamic = "force-dynamic";

type Resolved =
  | { kind: "product"; product: ApiProduct }
  | { kind: "category"; category: ApiCategory }
  | { kind: "post"; post: ApiPost }
  | { kind: "page"; page: ApiPage }
  | null;

function normalizePath(slug: string[]) {
  return slug.filter(Boolean).join("/").replace(/^\/|\/$/g, "");
}

async function resolve(path: string): Promise<Resolved> {
  const segments = path.split("/");
  const single = segments.length === 1 ? segments[0] : null;

  const [product, category, post, page] = await Promise.all([
    single ? serverFetch<ApiProduct>(`/products/${encodeURIComponent(single)}`) : null,
    serverFetch<ApiCategory>(`/categories/lookup${buildQuery({ path })}`),
    single ? serverFetch<ApiPost>(`/posts/${encodeURIComponent(single)}`) : null,
    single ? serverFetch<ApiPage>(`/pages/${encodeURIComponent(single)}`) : null,
  ]);

  if (product) return { kind: "product", product };
  if (category && category.path === path) return { kind: "category", category };
  if (post) return { kind: "post", post };
  if (page) return { kind: "page", page };
  if (category) return { kind: "category", category };
  return null;
}

async function fetchParentCategory(path: string) {
  const parentPath = path.split("/").slice(0, -1).join("/");
  return parentPath ? serverFetch<ApiCategory>(`/categories/lookup${buildQuery({ path: parentPath })}`) : null;
}

export async function generateMetadata(props: PageProps<"/[...slug]">): Promise<Metadata> {
  const params = await props.params;
  const resolved = await resolve(normalizePath(params.slug));
  if (!resolved) return {};

  switch (resolved.kind) {
    case "product":
      return {
        title: resolved.product.name,
        description: replaceBrandText(resolved.product.shortDescription ?? ""),
        openGraph: {
          title: resolved.product.name,
          images: resolved.product.featuredImage ? [resolved.product.featuredImage] : undefined,
        },
      };
    case "category":
      return {
        title: resolved.category.name,
        description: replaceBrandText(resolved.category.description ?? ""),
      };
    case "post":
      return {
        title: resolved.post.title,
        description: replaceBrandText(resolved.post.excerpt ?? ""),
        openGraph: { images: resolved.post.featuredImage ? [resolved.post.featuredImage] : undefined },
      };
    case "page":
      return {
        title: resolved.page.slug === "gioi-thieu" ? "Giới thiệu Idhub" : resolved.page.title,
        description: replaceBrandText(resolved.page.excerpt ?? ""),
      };
  }
}

export default async function CatchAllPage(props: PageProps<"/[...slug]">) {
  const params = await props.params;
  const path = normalizePath(params.slug);
  const resolved = await resolve(path);

  if (!resolved) {
    notFound();
  }

  switch (resolved.kind) {
    case "product": {
      const categoryPath = resolved.product.categories[0]?.path;
      const parentCategory = categoryPath ? await fetchParentCategory(categoryPath) : null;
      return <ProductTemplate product={resolved.product} parentCategory={parentCategory} />;
    }
    case "category": {
      const [products, parent] = await Promise.all([
        serverFetch<Paginated<ApiProduct>>(
          `/products${buildQuery({ category: resolved.category.path, limit: 100, sort: "featured" })}`,
        ),
        fetchParentCategory(resolved.category.path),
      ]);
      return (
        <CategoryTemplate
          category={resolved.category}
          parent={parent}
          products={(products?.items ?? []).map(apiProductToCommerce)}
        />
      );
    }
    case "post": {
      const latest = await serverFetch<Paginated<ApiPost>>(`/posts${buildQuery({ limit: 5 })}`);
      return <ArticleTemplate page={toContentDoc(resolved.post)} latestPosts={latest?.items ?? []} />;
    }
    case "page": {
      if (resolved.page.slug === "gioi-thieu" || resolved.page.template === "about") {
        return <AboutTemplate page={toContentDoc(resolved.page)} />;
      }
      const latest = await serverFetch<Paginated<ApiPost>>(`/posts${buildQuery({ limit: 5 })}`);
      return <ArticleTemplate page={toContentDoc(resolved.page)} latestPosts={latest?.items ?? []} />;
    }
  }
}
