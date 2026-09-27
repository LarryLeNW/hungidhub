import type { ApiProduct } from "@/lib/api/catalog";
import type { Product } from "@/types/commerce";

export const FALLBACK_PRODUCT_IMAGE =
  "https://khotaikhoan.net/wp-content/uploads/2026/08/hypic-pro.webp";

/**
 * Card model straight from the API. Counters stay at 0 when the product has no reviews/sales
 * yet — the card renders "Mới" instead of inventing numbers.
 */
export function apiProductToCommerce(product: ApiProduct): Product {
  const variants = product.variants;

  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription ?? "",
    categories: product.categories.map((category) => ({
      id: String(category.id),
      name: category.name,
      slug: category.slug,
      href: `/${category.path}`,
      description: category.description ?? "",
      productCount: 0,
    })),
    images: [
      {
        src: product.featuredImage ?? product.images?.[0]?.src ?? FALLBACK_PRODUCT_IMAGE,
        alt: product.name,
      },
    ],
    badges: product.badges ?? [],
    ratingAverage: product.ratingAverage,
    reviewCount: product.reviewCount,
    soldCount: product.soldCount,
    variants: variants.length
      ? variants.map((variant) => ({
          id: String(variant.id),
          apiVariantId: variant.id,
          sku: variant.sku,
          attributes: {
            accountType: variant.accountType ?? variant.name,
            duration: variant.duration ?? "",
          },
          salePrice: variant.price,
          regularPrice: variant.regularPrice ?? undefined,
          stockStatus: variant.stockStatus,
        }))
      : [
          {
            id: `${product.id}-none`,
            sku: String(product.id),
            attributes: { accountType: "Liên hệ", duration: "" },
            salePrice: 0,
            stockStatus: "out_of_stock",
          },
        ],
  };
}

export function cheapestVariant(product: Product) {
  return product.variants.reduce((best, variant) =>
    variant.salePrice < best.salePrice ? variant : best,
  );
}
