"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { Product } from "@/types/commerce";

type SortMode = "best" | "price" | "stock" | "rating";

const pageSize = 12;

export function CategoryProductBrowser({
  title,
  products,
}: {
  title: string;
  products: Product[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [sortMode, setSortMode] = useState<SortMode>("best");
  const [page, setPage] = useState(1);

  const sortedProducts = useMemo(() => {
    const next = [...products];
    if (sortMode === "price") {
      next.sort((a, b) => (a.variants[0]?.salePrice ?? 0) - (b.variants[0]?.salePrice ?? 0));
    } else if (sortMode === "rating") {
      next.sort((a, b) => b.ratingAverage - a.ratingAverage);
    } else if (sortMode === "stock") {
      next.sort((a, b) => {
        const aStock = a.variants[0]?.stockStatus ?? "out_of_stock";
        const bStock = b.variants[0]?.stockStatus ?? "out_of_stock";
        return aStock === bStock
          ? 0
          : aStock === "in_stock"
            ? -1
            : 1;
      });
    } else {
      next.sort((a, b) => b.soldCount - a.soldCount);
    }
    return next;
  }, [products, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleProducts = sortedProducts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (sectionRef.current) {
      const offset = 80;
      const elementPosition = sectionRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });
    }
  };

  function chooseSort(mode: SortMode) {
    setSortMode(mode);
    setPage(1);
  }

  return (
    <section ref={sectionRef} className="ktk-category-frame pb-8">
      <div className="mb-5 flex flex-col gap-3 border-t border-[#e5e7eb] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[24px] font-extrabold text-slate-950 md:text-[25px]">
          {title}
        </h1>
        <div className="flex items-center gap-3">
          <select
            className="focus-ring h-9 rounded-[5px] border border-[#d8e2ee] bg-white px-3 text-[13px] font-semibold text-slate-600"
            value={sortMode}
            onChange={(event) => chooseSort(event.target.value as SortMode)}
            aria-label="Sắp xếp sản phẩm"
          >
            <option value="best">Sắp xếp theo mức độ phổ biến</option>
            <option value="price">Sắp xếp theo giá thấp đến cao</option>
            <option value="stock">Sắp xếp theo tình trạng còn hàng</option>
            <option value="rating">Sắp xếp theo đánh giá cao</option>
          </select>
        </div>
      </div>

      {visibleProducts.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-white p-6 text-center text-sm text-muted">
          Danh mục này chưa có sản phẩm.
        </p>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            className="focus-ring grid size-10 place-items-center rounded-md border border-border bg-white disabled:opacity-40"
            type="button"
            aria-label="Trang trước"
            disabled={safePage === 1}
            onClick={() => handlePageChange(Math.max(1, safePage - 1))}
          >
            <ChevronLeft size={18} />
          </button>
          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNumber = index + 1;
            return (
              <button
                key={pageNumber}
                className={
                  safePage === pageNumber
                    ? "focus-ring size-10 rounded-md bg-primary text-sm font-extrabold text-white"
                    : "focus-ring size-10 rounded-md border border-border bg-white text-sm font-extrabold text-slate-700"
                }
                type="button"
                onClick={() => handlePageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            );
          })}
          <button
            className="focus-ring grid size-10 place-items-center rounded-md border border-border bg-white disabled:opacity-40"
            type="button"
            aria-label="Trang sau"
            disabled={safePage === totalPages}
            onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : null}
    </section>
  );
}
