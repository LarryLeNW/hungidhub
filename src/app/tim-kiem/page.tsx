import type { Metadata } from "next";
import { ProductCard } from "@/features/catalog/components/product-card";
import { buildQuery, type ApiProduct, type Paginated } from "@/lib/api/catalog";
import { serverFetch } from "@/lib/api/server";
import { apiProductToCommerce } from "@/lib/commerce-mapping";

export const metadata: Metadata = {
  title: "Tìm kiếm",
  description: "Tìm kiếm sản phẩm tại Idhub.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const results = query
    ? await serverFetch<Paginated<ApiProduct>>(
        `/products${buildQuery({ search: query, limit: 40, sort: "best_selling" })}`,
      )
    : null;
  const products = (results?.items ?? []).map(apiProductToCommerce);

  return (
    <main className="bg-white">
      <section className="container-page py-8">
        <p className="text-sm font-extrabold uppercase text-primary-strong">Tìm kiếm</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-950">
          {query ? `Kết quả cho “${query}”` : "Nhập từ khóa để tìm sản phẩm"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {query
            ? results
              ? `Tìm thấy ${results.total} sản phẩm phù hợp.`
              : "Không kết nối được máy chủ, vui lòng thử lại."
            : "Bạn có thể tìm theo tên sản phẩm, công cụ hoặc loại tài khoản."}
        </p>

        {query && products.length ? (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
