"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import { useCommerce } from "@/components/commerce/commerce-provider";
import type { Product } from "@/types/commerce";
import { Price } from "@/features/catalog/components/price";
import { RatingStars } from "@/features/catalog/components/rating-stars";
import { cheapestVariant } from "@/lib/commerce-mapping";

type ProductCardProps = {
  product: Product;
  priority?: boolean;
  buttonLabel?: string;
};

export function ProductCard({
  product,
  priority = false,
  buttonLabel = "Chọn gói",
}: ProductCardProps) {
  const commerce = useCommerce();
  const defaultVariant = cheapestVariant(product);
  const isWishlisted = commerce.isWishlisted(product.slug);
  const canBuy = Boolean(defaultVariant.apiVariantId) && defaultVariant.stockStatus !== "out_of_stock";
  const isBuyNow = buttonLabel.toLowerCase() === "mua ngay";

  const snapshot = {
    id: product.id,
    slug: product.slug,
    title: product.name,
    image: product.images[0].src,
    price: defaultVariant.salePrice,
    regularPrice: defaultVariant.regularPrice,
  };

  return (
    <article className="group overflow-hidden rounded-[8px] border border-[#dfe8f2] bg-surface shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[var(--shadow-soft)]">
      <div className="relative aspect-square overflow-hidden bg-surface-muted">
        <Link href={`/${product.slug}`} className="relative block h-full">
          <Image
            src={product.images[0].src}
            alt={product.images[0].alt}
            fill
            sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        </Link>
        {product.badges.slice(0, 1).map((badge) => (
          <span
            key={badge}
            className="absolute left-3 top-3 rounded-full bg-[#ff4d6d] px-3 py-1.5 text-xs font-extrabold text-white"
          >
            {badge === "Sale" ? "Giảm sâu" : badge}
          </span>
        ))}
        <button
          className={
            isWishlisted
              ? "focus-ring absolute right-3 top-3 grid size-9 cursor-pointer place-items-center rounded-full bg-[#ff4d6d] text-white shadow-sm transition"
              : "focus-ring absolute right-3 top-3 grid size-9 cursor-pointer place-items-center rounded-full bg-white text-slate-700 shadow-sm transition hover:text-danger"
          }
          type="button"
          aria-label="Thêm vào yêu thích"
          title="Thêm vào yêu thích"
          onClick={() => commerce.toggleWishlist(snapshot)}
        >
          <Heart size={18} className={isWishlisted ? "fill-current" : ""} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-2.5 p-3">
        <div>
          <Link
            href={`/${product.slug}`}
            className="line-clamp-2 min-h-[38px] text-[14px] font-extrabold leading-5 text-slate-950 transition hover:text-primary-strong"
          >
            {product.name}
          </Link>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
            {product.reviewCount > 0 ? (
              <RatingStars rating={product.ratingAverage} compact />
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-700">
                Mới
              </span>
            )}
            {product.soldCount > 0 ? (
              <span>{product.soldCount.toLocaleString("vi-VN")} đã bán</span>
            ) : null}
          </div>
        </div>

        {defaultVariant.salePrice > 0 ? (
          <Price salePrice={defaultVariant.salePrice} regularPrice={defaultVariant.regularPrice} />
        ) : (
          <p className="text-[13px] font-bold text-muted">Liên hệ để báo giá</p>
        )}

        <button
          className="focus-ring inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[6px] bg-[#ecfdf5] px-3 text-[12px] font-extrabold text-[#15803d] transition hover:bg-[#dcfce7] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={!canBuy}
          onClick={() => {
            commerce.addToCart(snapshot, {
              variantId: defaultVariant.apiVariantId,
              variantLabel: defaultVariant.attributes.accountType,
              durationLabel: defaultVariant.attributes.duration || undefined,
            });
            if (isBuyNow) commerce.openCheckout();
          }}
        >
          <ShoppingCart size={14} aria-hidden="true" />
          {canBuy ? buttonLabel : "Hết hàng"}
        </button>
      </div>
    </article>
  );
}
