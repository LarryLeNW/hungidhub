import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogTemplate } from "@/components/wp/blog-template";
import { buildQuery, type Paginated } from "@/lib/api/catalog";
import { toContentDoc, type ApiPage, type ApiPost } from "@/lib/api/content";
import { serverFetch } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "Blog",
  description: "Hướng dẫn sử dụng, so sánh và cập nhật các công cụ số tại Idhub.",
};

export default async function BlogPage({
  searchParams,
}: PageProps<"/blog">) {
  const params = await searchParams;
  const pageNumber = Math.max(1, Number(params?.page ?? 1) || 1);
  const [page, posts] = await Promise.all([
    serverFetch<ApiPage>("/pages/blog"),
    serverFetch<Paginated<ApiPost>>(
      `/posts${buildQuery({ page: pageNumber, limit: 13 })}`,
    ),
  ]);

  if (!page) notFound();

  return (
    <BlogTemplate
      page={toContentDoc(page)}
      posts={posts ?? { items: [], total: 0, page: 1, limit: 13, totalPages: 1 }}
    />
  );
}
