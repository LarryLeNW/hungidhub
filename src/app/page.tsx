import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Clock3,
  CreditCard,
  Flame,
  Star,
  Users,
} from "lucide-react";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { ProductCard } from "@/features/catalog/components/product-card";
import { fetchProductsBySlugs, type ApiProduct } from "@/lib/api/catalog";
import type { ApiContentBlock } from "@/lib/api/content";
import { serverFetch } from "@/lib/api/server";
import type { HomeSection, PublicSettings } from "@/lib/api/settings";
import { apiProductToCommerce } from "@/lib/commerce-mapping";

type Banner = { href: string; src: string; alt: string };

function toBanner(block: ApiContentBlock): Banner | null {
  if (!block.imageUrl) return null;
  return { href: block.linkUrl ?? "#", src: block.imageUrl, alt: block.title };
}

export default async function Home() {
  const [blocks, settings] = await Promise.all([
    serverFetch<ApiContentBlock[]>("/content-blocks/home"),
    serverFetch<PublicSettings>("/settings/public"),
  ]);

  const banners = (blocks ?? []).map(toBanner).filter((banner): banner is Banner => Boolean(banner));
  const carousel = banners.slice(0, 3);
  const megaBanner = banners[3] ?? null;
  const sideBanners = banners.slice(1, 3);
  const saleBanner = banners[4] ?? null;

  const sections: HomeSection[] = settings?.["home.sections"] ?? [];
  const live = await fetchProductsBySlugs(sections.flatMap((section) => section.slugs));
  const resolved = sections
    .map((section) => ({
      ...section,
      products: section.slugs
        .map((slug) => live.get(slug))
        .filter((product): product is ApiProduct => Boolean(product)),
    }))
    .filter((section) => section.products.length > 0);
  const [flashSale, ...otherSections] = resolved;

  return (
    <main>
      {carousel.length ? (
        <section className="bg-[#f5f8fb] pb-0 pt-8 lg:pt-5">
          <div className="ktk-page-frame">
            <div className="grid gap-2 lg:grid-cols-2 lg:gap-5">
              <HeroCarousel slides={carousel} />

              {megaBanner || sideBanners.length ? (
                <div className="hidden gap-[14px] lg:grid">
                  {megaBanner ? (
                    <Link
                      href={megaBanner.href}
                      className="focus-ring group relative block min-h-[260px] overflow-hidden rounded-[8px] bg-emerald-100"
                    >
                      <Image
                        src={megaBanner.src}
                        alt={megaBanner.alt}
                        fill
                        priority
                        sizes="(min-width: 1024px) 600px, 100vw"
                        className="object-cover transition duration-300 group-hover:scale-[1.015]"
                      />
                    </Link>
                  ) : null}

                  {sideBanners.length ? (
                    <div className="grid gap-[10px] sm:grid-cols-2">
                      {sideBanners.map((banner) => (
                        <Link
                          key={banner.src}
                          href={banner.href}
                          className="focus-ring group relative block min-h-[185px] overflow-hidden rounded-[8px] bg-slate-100"
                        >
                          <Image
                            src={banner.src}
                            alt={banner.alt}
                            fill
                            sizes="(min-width: 1024px) 294px, 100vw"
                            className="object-cover transition duration-300 group-hover:scale-[1.015]"
                          />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {saleBanner ? (
        <section className="bg-[#f5f8fb] pb-5 pt-[52px] lg:pt-[53px]">
          <div className="ktk-sale-frame">
            <Link
              href={saleBanner.href}
              className="focus-ring relative block min-h-[119px] overflow-hidden rounded-[8px] bg-red-600 lg:min-h-[180px]"
            >
              <Image src={saleBanner.src} alt={saleBanner.alt} fill sizes="1200px" className="object-cover" />
            </Link>
          </div>
        </section>
      ) : null}

      {flashSale ? (
        <section className="bg-[#a82a35] pb-8 pt-2 lg:bg-white lg:pt-0">
          <div className="ktk-wide-mobile-frame">
            <div className="mb-3 hidden items-center justify-between lg:flex">
              <div className="inline-flex h-[42px] items-center gap-2 rounded-[4px] bg-[#ef233c] px-4 text-[18px] font-extrabold text-white">
                <Flame size={20} className="fill-current" aria-hidden="true" />
                {flashSale.title}
              </div>
              <Link
                href="/ung-dung-phan-mem-khac/cong-cu-ai"
                className="focus-ring inline-flex items-center gap-1 text-[14px] font-extrabold text-primary-strong"
              >
                Xem tất cả
                <ChevronRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {flashSale.products.slice(0, 10).map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={apiProductToCommerce(product)}
                  priority={index < 4}
                  buttonLabel="Mua ngay"
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-white py-10">
          <div className="ktk-page-frame rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">
            Chưa có sản phẩm để hiển thị. Hãy nhập sản phẩm và cấu hình khối trang chủ trong trang quản trị.
          </div>
        </section>
      )}

      {otherSections.map((section, index) => (
        <ProductSection
          key={section.key}
          title={section.title}
          subtitle={section.subtitle ?? ""}
          products={section.products}
          tone={section.tone ?? "light"}
          trustStripAfter={index === 1}
        />
      ))}

      {otherSections.length < 2 ? <TrustStrip /> : null}
      <NumbersPanel />
      <CustomerReviews />
    </main>
  );
}

function ProductSection({
  title,
  subtitle,
  products,
  tone = "light",
  trustStripAfter = false,
}: {
  title: string;
  subtitle: string;
  products: ApiProduct[];
  tone?: "light" | "green";
  trustStripAfter?: boolean;
}) {
  return (
    <>
      <section
        className={
          tone === "green"
            ? "ktk-green-section py-8 lg:py-10"
            : "bg-[#f5f5f5] py-8 lg:py-10"
        }
      >
        <div className={tone === "green" ? "ktk-wide-mobile-frame relative z-[1]" : "ktk-wide-mobile-frame"}>
          <div className="mb-5">
            <h2 className={tone === "green" ? "ktk-green-section-title text-[22px] font-extrabold text-white" : "text-[22px] font-extrabold text-[#15803d]"}>
              {title}
            </h2>
            {subtitle ? (
              <p className={tone === "green" ? "mt-1 text-[13px] font-semibold text-white/85" : "mt-1 text-[13px] text-slate-500"}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {products.slice(0, 10).map((product) => (
              <ProductCard key={product.id} product={apiProductToCommerce(product)} />
            ))}
          </div>
        </div>
      </section>
      {trustStripAfter ? <TrustStrip /> : null}
    </>
  );
}

function TrustStrip() {
  const items = [
    ["01", "Giao đúng thông tin", "Tài khoản, thời hạn và hướng dẫn dùng được gửi rõ ràng sau khi đơn hoàn tất."],
    ["02", "Giá hiển thị minh bạch", "Bạn thấy giá trước khi đặt, không thêm phí ẩn ở bước thanh toán."],
    ["03", "Bảo hành có theo dõi", "Nếu gói phát sinh lỗi trong thời hạn cam kết, Idhub hỗ trợ kiểm tra và đổi theo chính sách."],
    ["04", "Có người hỗ trợ", "Khi cần kích hoạt, đổi thiết bị hoặc kiểm tra đơn, bạn có thể nhắn Zalo để được xử lý."],
  ];

  return (
    <section className="bg-[#f5f5f5] py-8">
      <div className="ktk-page-frame">
        <h2 className="mb-5 text-center text-[20px] font-extrabold text-slate-950">
          Những điều Idhub giữ rõ với khách hàng
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(([step, title, desc]) => (
            <div key={step} className="rounded-[8px] bg-white p-5 text-center shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <div className="text-[20px] font-extrabold text-[#15803d]">{step}</div>
              <h3 className="mt-2 text-[14px] font-extrabold text-slate-950">{title}</h3>
              <p className="mt-2 text-[12px] leading-5 text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NumbersPanel() {
  const stats = [
    [Users, "Tư vấn đúng nhu cầu", "Không chắc chọn gói nào, bạn có thể hỏi trước khi mua."],
    [CreditCard, "Thanh toán dễ kiểm tra", "Thông tin chuyển khoản và trạng thái đơn được trình bày rõ ràng."],
    [Clock3, "Giao theo khung cam kết", "Sản phẩm có sẵn được xử lý nhanh; gói nâng cấp có thời gian riêng."],
    [Star, "Bảo hành sau khi nhận", "Lỗi phát sinh được kiểm tra theo đúng điều kiện của từng sản phẩm."],
  ];

  return (
    <section className="bg-[#f5f5f5] py-8">
      <div className="ktk-page-frame rounded-[10px] border border-[#d9f7e5] bg-[#f7fffa] px-4 py-8 shadow-[0_6px_24px_rgba(15,23,42,0.05)] lg:px-10">
        <p className="inline-flex rounded-full bg-white px-4 py-1 text-[11px] font-extrabold uppercase text-[#15803d] shadow-sm">
          Cách Idhub vận hành đơn hàng
        </p>
        <h2 className="mt-4 max-w-[700px] text-[25px] font-extrabold leading-tight text-slate-950">
          Không chỉ bán tài khoản, Idhub làm rõ từng bước để bạn dễ kiểm tra và dùng ổn định hơn
        </h2>
        <p className="mt-3 max-w-[720px] text-[14px] leading-6 text-slate-600">
          Mỗi nhóm sản phẩm có cách giao và bảo hành khác nhau. Vì vậy các thông tin quan trọng được đặt ngay trong luồng mua hàng: loại gói, thời hạn, email nhận, cách kích hoạt và kênh hỗ trợ sau bán.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([Icon, value, label]) => (
            <div key={String(value)} className="rounded-[8px] border border-[#e5edf6] bg-white p-4 shadow-sm">
              <Icon className="text-[#15803d]" size={24} aria-hidden="true" />
              <div className="mt-3 text-[15px] font-extrabold text-slate-950">{String(value)}</div>
              <p className="mt-2 text-[13px] leading-5 text-slate-500">{String(label)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CustomerReviews() {
  const reviews = [
    ["Cần dùng ngay trong ngày", "Các gói có sẵn được ưu tiên giao nhanh kèm hướng dẫn đăng nhập để khách kiểm tra ngay."],
    ["Chưa biết chọn nền tảng nào", "Đội hỗ trợ hỏi lại nhu cầu trước khi gợi ý, nhất là với nhóm AI, VPN và học tập."],
    ["Gặp lỗi sau khi mua", "Khách gửi mã đơn và ảnh lỗi để Idhub kiểm tra theo chính sách bảo hành của từng sản phẩm."],
  ];

  return (
    <section className="bg-[#f5f5f5] pb-10 pt-4">
      <div className="ktk-page-frame">
        <h2 className="text-center text-[22px] font-extrabold text-slate-950">
          Những tình huống Idhub thường hỗ trợ
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {reviews.map(([name, text]) => (
            <article key={name} className="rounded-[8px] bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <div className="flex text-[#ffb300]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} size={15} className="fill-current" aria-hidden="true" />
                ))}
              </div>
              <p className="mt-4 text-[14px] leading-6 text-slate-600">{text}</p>
              <p className="mt-4 text-[13px] font-extrabold text-slate-950">{name}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
