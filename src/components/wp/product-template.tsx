"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  LoaderCircle,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Star,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useCommerce } from "@/components/commerce/commerce-provider";
import { ContentBody } from "@/components/wp/content-body";
import { catalogApi, type ApiCategory, type ApiProduct, type ApiReview, type ApiVariant } from "@/lib/api/catalog";
import { replaceBrandText } from "@/lib/brand";
import { FALLBACK_PRODUCT_IMAGE } from "@/lib/commerce-mapping";
import { formatDateTime } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

type ProductTemplateProps = {
  product: ApiProduct;
  parentCategory: ApiCategory | null;
};

type Option = {
  /** Stable identity for selection (group label for packages, variant id for durations). */
  key: string;
  label: string;
  price: number;
  regularPrice: number | null;
  disabled?: boolean;
  /** Backend variant id when the option resolves to exactly one variant. */
  variantId?: number;
};

export function ProductTemplate({ product, parentCategory }: ProductTemplateProps) {
  const commerce = useCommerce();
  const { user } = useAuth();
  const category = product.categories[0] ?? null;

  const packageOptions = useMemo(() => buildPackageOptions(product.variants), [product.variants]);
  const [packageChoice, setPackageChoice] = useState<string | null>(null);
  const selectedPackage =
    packageOptions.find((option) => option.key === packageChoice) ?? packageOptions[0] ?? null;
  const durationOptions = useMemo(
    () => (selectedPackage ? buildDurationOptions(product.variants, selectedPackage.label) : []),
    [product.variants, selectedPackage],
  );
  const [durationChoice, setDurationChoice] = useState<string | null>(null);
  const selectedDuration = durationOptions.length
    ? (durationOptions.find((option) => option.key === durationChoice) ?? durationOptions[0])
    : null;
  const selectedOption = selectedDuration ?? selectedPackage;
  const canBuy = Boolean(selectedOption?.variantId) && !selectedOption?.disabled;

  const gallery = useMemo(
    () =>
      [...new Set([product.featuredImage, ...(product.images ?? []).map((image) => image.src)])].filter(
        (src): src is string => Boolean(src),
      ),
    [product.featuredImage, product.images],
  );
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const shownImage = activeImage ?? gallery[0] ?? null;
  const [toast, setToast] = useState<string | null>(null);

  const hasAutoDelivery = product.variants.some((variant) => variant.deliveryType === "auto");
  const deliveryText =
    product.deliveryTimeText ??
    (hasAutoDelivery ? "Giao tự động sau khi thanh toán" : "Giao thủ công sau khi thanh toán");
  const warrantyText = product.warrantyDays
    ? `Bảo hành ${product.warrantyDays} ngày`
    : "Bảo hành theo từng gói";
  const discountPercent =
    selectedOption?.regularPrice && selectedOption.regularPrice > selectedOption.price
      ? Math.round((1 - selectedOption.price / selectedOption.regularPrice) * 100)
      : null;

  const productSnapshot = {
    id: String(product.id),
    slug: product.slug,
    title: product.name,
    image: shownImage ?? undefined,
    price: selectedOption?.price ?? 0,
    regularPrice: selectedOption?.regularPrice ?? undefined,
  };
  const cartOptions = {
    variantId: selectedOption?.variantId,
    variantLabel: selectedPackage?.label ?? "Gói mặc định",
    durationLabel: selectedDuration?.label,
  };

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  function addToCart() {
    commerce.addToCart(productSnapshot, cartOptions);
    showToast("Đã thêm sản phẩm vào giỏ hàng");
  }

  function buyNow() {
    commerce.addToCart(productSnapshot, cartOptions);
    commerce.openCheckout();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: gallery.length ? gallery : undefined,
    description: replaceBrandText(product.shortDescription ?? ""),
    sku: selectedOption?.variantId ? String(selectedOption.variantId) : String(product.id),
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage.toFixed(1),
            reviewCount: product.reviewCount,
          },
        }
      : {}),
    ...(selectedOption
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "VND",
            price: selectedOption.price,
            availability: canBuy ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };

  return (
    <main className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {toast ? (
        <div className="fixed right-4 top-4 z-[90] rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      ) : null}

      <nav className="ktk-product-frame flex h-[70px] items-center overflow-hidden whitespace-nowrap text-[16px] text-slate-500 lg:h-[80px]">
        <Link href="/" className="hover:text-primary-strong">Trang chủ</Link>
        {parentCategory ? (
          <>
            <span className="mx-2 text-slate-300">/</span>
            <Link href={`/${parentCategory.path}`} className="hover:text-primary-strong">
              {parentCategory.name}
            </Link>
          </>
        ) : null}
        {category ? (
          <>
            <span className="mx-2 text-slate-300">/</span>
            <Link href={`/${category.path}`} className="hover:text-primary-strong">
              {category.name}
            </Link>
          </>
        ) : null}
        <span className="mx-2 text-slate-300">/</span>
        <strong className="truncate text-slate-950">{product.name}</strong>
      </nav>

      <section className="ktk-product-frame grid gap-7 pb-8 lg:grid-cols-[526px_1fr] lg:gap-6">
        <div>
          <div className="relative overflow-hidden rounded-[7px] bg-[#f8fafc]">
            <Image
              src={shownImage ?? FALLBACK_PRODUCT_IMAGE}
              alt={product.name}
              width={900}
              height={900}
              priority
              sizes="(min-width: 1024px) 526px, 100vw"
              className="aspect-square h-auto w-full object-cover"
            />
            {discountPercent ? (
              <span className="absolute left-0 top-4 rounded-r-full bg-[#15803d] px-3 py-1 text-[13px] font-extrabold text-white">
                -{discountPercent}%
              </span>
            ) : null}
          </div>
          {gallery.length > 1 ? (
            <div className="mt-3 hidden gap-2 lg:flex">
              {gallery.map((image) => (
                <button
                  key={image}
                  className={
                    image === shownImage
                      ? "relative size-16 cursor-pointer overflow-hidden rounded-md border-2 border-primary"
                      : "relative size-16 cursor-pointer overflow-hidden rounded-md border border-border"
                  }
                  type="button"
                  aria-label="Chọn ảnh sản phẩm"
                  onClick={() => setActiveImage(image)}
                >
                  <Image src={image} alt={product.name} fill className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="text-[27px] font-extrabold leading-tight text-slate-950 lg:text-[29px]">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px] text-slate-500">
            {product.reviewCount > 0 ? (
              <>
                <span className="inline-flex items-center gap-0.5 text-[#ffb300]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      size={14}
                      className={index < Math.round(product.ratingAverage) ? "fill-current" : "opacity-30"}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <strong className="text-slate-950">{product.ratingAverage.toFixed(1)}</strong>
                <a className="font-bold text-[#15803d]" href="#reviews">
                  {product.reviewCount} đánh giá
                </a>
              </>
            ) : (
              <a className="font-bold text-[#15803d]" href="#reviews">
                Chưa có đánh giá — hãy là người đầu tiên
              </a>
            )}
            {product.soldCount > 0 ? (
              <>
                <span>·</span>
                <span>{product.soldCount.toLocaleString("vi-VN")} đã bán</span>
              </>
            ) : null}
            {product.badges?.length ? (
              <span className="w-full rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-extrabold text-emerald-700 lg:w-auto">
                {product.badges[0] === "Sale" ? "Đang giảm giá" : product.badges[0]}
              </span>
            ) : null}
          </div>

          {selectedOption ? (
            <div className="mx-[-16px] mt-5 flex h-[40px] items-center gap-3 bg-[#f7f7f7] px-4 lg:mx-0 lg:mt-7">
              {selectedOption.regularPrice && selectedOption.regularPrice > selectedOption.price ? (
                <del className="text-[20px] font-semibold text-slate-400">
                  {formatCurrency(selectedOption.regularPrice)}
                </del>
              ) : null}
              <span className="text-[27px] font-extrabold text-red-600">
                {formatCurrency(selectedOption.price)}
              </span>
            </div>
          ) : (
            <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-[14px] font-bold text-amber-800">
              Sản phẩm chưa có gói để đặt. Vui lòng liên hệ hỗ trợ.
            </p>
          )}

          {product.shortDescription ? (
            <p className="mt-3 text-[17px] leading-[1.55] text-slate-950">
              {replaceBrandText(product.shortDescription)}
            </p>
          ) : null}

          <div className="mt-4 h-px bg-[#e5e7eb]" />

          <div className="mt-5 grid gap-2 rounded-[8px] border border-[#d9f7e5] bg-[#f7fffa] p-3 text-[13px] font-semibold text-slate-700 sm:grid-cols-3">
            <span className="inline-flex items-center gap-2">
              <PackageCheck size={17} className="text-primary" aria-hidden="true" />
              {deliveryText}
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={17} className="text-primary" aria-hidden="true" />
              {warrantyText}
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={17} className="text-primary" aria-hidden="true" />
              Chuyển khoản / Zalo / số dư Idhub
            </span>
          </div>

          {packageOptions.length ? (
            <OptionGroup
              label="Loại gói:"
              options={packageOptions}
              selected={selectedPackage}
              onSelect={(option) => {
                setPackageChoice(option.key);
                setDurationChoice(null);
              }}
            />
          ) : null}

          {durationOptions.length ? (
            <OptionGroup
              label="Thời hạn:"
              options={durationOptions}
              selected={selectedDuration}
              onSelect={(option) => setDurationChoice(option.key)}
            />
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="focus-ring inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[4px] bg-primary px-5 font-extrabold text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canBuy}
              onClick={addToCart}
            >
              <ShoppingCart size={18} aria-hidden="true" />
              Thêm vào giỏ
            </button>
            <button
              type="button"
              className="focus-ring inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[4px] bg-accent px-5 font-extrabold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canBuy}
              onClick={buyNow}
            >
              <Zap size={18} aria-hidden="true" />
              {canBuy ? "Mua ngay" : "Hết hàng"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              [BadgeCheck, warrantyText],
              [CheckCircle2, "Đối soát chuyển khoản tự động"],
              [Zap, deliveryText],
            ].map(([Icon, text]) => (
              <div
                key={text as string}
                className="flex items-center gap-2 rounded-[4px] border border-border px-3 py-2 text-sm font-bold text-slate-700"
              >
                <Icon size={18} className="shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{text as string}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {product.contentHtml ? (
        <section className="ktk-product-frame border-t border-[#eef2f7] py-8">
          <ContentBody html={product.contentHtml} />
        </section>
      ) : null}

      <ReviewsSection
        product={product}
        defaultAuthor={user?.fullName ?? ""}
        onToast={showToast}
      />
    </main>
  );
}

function ReviewsSection({
  product,
  defaultAuthor,
  onToast,
}: {
  product: ApiProduct;
  defaultAuthor: string;
  onToast: (message: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "5" | "4">("all");
  const [reviews, setReviews] = useState<ApiReview[] | null>(null);
  const [summary, setSummary] = useState({ ratingAverage: product.ratingAverage, reviewCount: product.reviewCount });
  const [name, setName] = useState(defaultAuthor);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    catalogApi
      .listReviews(product.slug, { limit: 20, rating: filter === "all" ? undefined : Number(filter) })
      .then((page) => {
        if (!active) return;
        setReviews(page.items);
        setSummary(page.summary);
      })
      .catch(() => {
        if (active) setReviews([]);
      });
    return () => {
      active = false;
    };
  }, [product.slug, filter]);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      await catalogApi.createReview(product.slug, { authorName: name.trim(), rating, content: content.trim() });
      setContent("");
      onToast("Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi được duyệt.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được đánh giá.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="reviews" className="ktk-product-frame border-t border-[#eef2f7] py-8">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950">Đánh giá sản phẩm</h2>
          <p className="mt-1 text-sm text-muted">
            {summary.reviewCount > 0
              ? `${summary.ratingAverage.toFixed(1)}/5 từ ${summary.reviewCount} đánh giá đã duyệt`
              : "Chưa có đánh giá nào được duyệt."}
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["all", "Tất cả"],
              ["5", "5 sao"],
              ["4", "4 sao"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={
                filter === value
                  ? "cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-bold text-white"
                  : "cursor-pointer rounded-md border border-border px-3 py-2 text-sm font-bold"
              }
              type="button"
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {reviews === null ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Đang tải đánh giá…
            </p>
          ) : reviews.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
              Chưa có đánh giá {filter === "all" ? "" : `${filter} sao `}cho sản phẩm này.
            </p>
          ) : (
            reviews.map((review) => (
              <article key={review.id} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-extrabold text-slate-950">{review.authorName}</h3>
                  <span className="text-sm font-bold text-[#ffb300]">{"★".repeat(review.rating)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{review.content}</p>
                <p className="mt-2 text-[12px] text-muted">{formatDateTime(review.createdAt)}</p>
              </article>
            ))
          )}
        </div>
        <div className="rounded-md border border-border p-4">
          <h3 className="font-extrabold text-slate-950">Gửi đánh giá</h3>
          <input
            className="mt-3 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-primary"
            placeholder="Tên của bạn"
            value={name}
            disabled={pending}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Số sao">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} sao`}
                className="cursor-pointer text-[#ffb300]"
                onClick={() => setRating(value)}
              >
                <Star size={22} className={value <= rating ? "fill-current" : "opacity-30"} aria-hidden="true" />
              </button>
            ))}
            <span className="ml-2 text-sm font-bold text-slate-700">{rating} sao</span>
          </div>
          <textarea
            className="mt-3 min-h-24 w-full rounded-md border border-border p-3 text-sm outline-none focus:border-primary"
            placeholder="Nội dung đánh giá (tối thiểu 5 ký tự)"
            value={content}
            disabled={pending}
            onChange={(event) => setContent(event.currentTarget.value)}
          />
          {error ? (
            <p role="alert" className="mt-2 text-[13px] font-semibold text-red-600">{error}</p>
          ) : null}
          <button
            className="mt-3 h-10 w-full cursor-pointer rounded-md bg-primary text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={pending || name.trim().length < 2 || content.trim().length < 5}
            onClick={() => void submit()}
          >
            {pending ? "Đang gửi…" : "Gửi đánh giá"}
          </button>
          <p className="mt-2 text-[12px] leading-5 text-muted">Đánh giá được kiểm duyệt trước khi hiển thị.</p>
        </div>
      </div>
    </section>
  );
}

function OptionGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: Option[];
  selected: Option | null;
  onSelect: (option: Option) => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-3 text-[16px] font-extrabold text-slate-950">{label}</div>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <button
            key={option.key}
            className={
              selected?.key === option.key
                ? "focus-ring h-[39px] cursor-pointer rounded-[4px] bg-[#15803d] px-5 text-[15px] font-bold text-white"
                : option.disabled
                  ? "h-[39px] cursor-not-allowed rounded-[4px] border border-[#cfdbe8] bg-[#f8fbfb] px-5 text-[15px] font-medium text-slate-400 line-through"
                  : "focus-ring h-[39px] cursor-pointer rounded-[4px] border border-[#cfdbe8] bg-[#f8fbfb] px-5 text-[15px] font-medium text-slate-700"
            }
            type="button"
            disabled={option.disabled}
            onClick={() => onSelect(option)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Package group of a variant: its `accountType`, falling back to the variant name. */
const packageKey = (variant: ApiVariant) => variant.accountType?.trim() || variant.name;

function groupVariants(variants: ApiVariant[]) {
  const groups = new Map<string, ApiVariant[]>();
  for (const variant of [...variants].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)) {
    const key = packageKey(variant);
    groups.set(key, [...(groups.get(key) ?? []), variant]);
  }
  return groups;
}

/**
 * Package buttons = distinct `accountType` (or variant name); price shown = cheapest in the group.
 * A package with a single variant resolves to it directly (no duration step).
 */
function buildPackageOptions(variants: ApiVariant[]): Option[] {
  return [...groupVariants(variants).entries()].map(([label, group]) => {
    const cheapest = group.reduce((best, item) => (item.price < best.price ? item : best));
    return {
      key: label,
      label,
      price: cheapest.price,
      regularPrice: cheapest.regularPrice,
      variantId: group.length === 1 ? group[0].id : undefined,
      disabled: group.every((item) => item.stockStatus === "out_of_stock"),
    };
  });
}

/**
 * Duration buttons for the selected package – one per variant in the group, so every variant is
 * reachable even when some have no `duration` (those show as "Mặc định" / their own name).
 */
function buildDurationOptions(variants: ApiVariant[], packageLabel: string): Option[] {
  const group = groupVariants(variants).get(packageLabel) ?? [];
  if (group.length < 2) return [];
  return group.map((variant) => {
    const ownName = variant.name.replace(packageLabel, "").replace(/^[\s·\-–—|]+|[\s·\-–—|]+$/g, "");
    return {
      key: String(variant.id),
      label: variant.duration?.trim() || ownName || "Mặc định",
      price: variant.price,
      regularPrice: variant.regularPrice,
      variantId: variant.id,
      disabled: variant.stockStatus === "out_of_stock",
    };
  });
}
