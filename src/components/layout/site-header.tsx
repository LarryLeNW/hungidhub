"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Gamepad2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Headphones,
  Heart,
  Home,
  Laptop,
  Menu,
  Search,
  ShieldCheck,
  ShoppingCart,
  Tags,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { IdhubLogo } from "@/components/Idhub-logo";
import { useCommerce } from "@/components/commerce/commerce-provider";
import { catalogApi, type ApiCategory, type ApiProduct } from "@/lib/api/catalog";
import { phoneHref, type PublicSettings } from "@/lib/api/settings";
import { formatCurrency } from "@/lib/format";

const zaloUrl =
  "/icons/zalo.png";

/** lucide icon names stored on categories (see backend importer) -> components. */
const categoryIcons: Record<string, LucideIcon> = {
  Bot,
  GraduationCap,
  Laptop,
  Headphones,
  ShieldCheck,
  Wrench,
  Gamepad2,
  Tags,
};

const navLinks: { href: string; label: string; iconSrc?: string; icon?: LucideIcon }[] = [
  {
    href: "/",
    label: "Trang chủ",
    icon: Home,
  },
  {
    href: "/gioi-thieu",
    label: "Giới Thiệu",
    iconSrc: "https://khotaikhoan.net/wp-content/uploads/2026/02/Untitled-1-03.png",
  },
  {
    href: "/huong-dan-mua-hang",
    label: "Hướng dẫn",
    iconSrc: "https://khotaikhoan.net/wp-content/uploads/2025/10/Icon-ktk-02.png",
  },
  {
    href: "/blog",
    label: "Blog tin tức",
    iconSrc: "https://khotaikhoan.net/wp-content/uploads/2025/10/Icon-ktk-01.png",
  },
];

type SiteHeaderProps = {
  categories: ApiCategory[];
  settings: PublicSettings;
};

export function SiteHeader({ categories, settings }: SiteHeaderProps) {
  const commerce = useCommerce();
  const pathname = usePathname();
  const hotline = settings["store.hotline"] ?? "0931 729 316";
  const categoryMenuItems = categories
    .filter((category) => category.parentId === null)
    .map((category) => ({
      href: `/${category.path}`,
      label: category.name,
      icon: (category.icon && categoryIcons[category.icon]) || Tags,
      children: (category.children ?? []).map((child) => ({ href: `/${child.path}`, label: child.name })),
    }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  /** Root category whose children are shown in the desktop flyout (hover/focus). */
  const [flyout, setFlyout] = useState<string | null>(null);
  /** Vertical offset (px) of the hovered root row inside the dropdown – the flyout aligns to it. */
  const [flyoutTop, setFlyoutTop] = useState(0);
  /** Root category expanded in the mobile drawer. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const categoryRef = useRef<HTMLDivElement>(null);
  const categoryCloseTimer = useRef<number | null>(null);
  const activeCategoryHref = categoryMenuItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const flyoutItem = categoryOpen ? categoryMenuItems.find((item) => item.href === flyout && item.children.length > 0) ?? null : null;

  const clearCategoryTimer = useCallback(() => {
    if (categoryCloseTimer.current !== null) {
      window.clearTimeout(categoryCloseTimer.current);
      categoryCloseTimer.current = null;
    }
  }, []);

  const openCategory = useCallback(() => {
    clearCategoryTimer();
    setCategoryOpen(true);
  }, [clearCategoryTimer]);

  const closeCategory = useCallback(
    (delay = 0) => {
      clearCategoryTimer();
      if (delay <= 0) {
        setCategoryOpen(false);
        return;
      }
      categoryCloseTimer.current = window.setTimeout(() => {
        categoryCloseTimer.current = null;
        setCategoryOpen(false);
      }, delay);
    },
    [clearCategoryTimer],
  );

  useEffect(() => clearCategoryTimer, [clearCategoryTimer]);

  useEffect(() => {
    if (!categoryOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!categoryRef.current?.contains(event.target as Node)) {
        closeCategory();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCategory();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [categoryOpen, closeCategory]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    lastScrollY.current = window.scrollY;

    function syncHeaderVisibility() {
      if (!mediaQuery.matches || menuOpen || categoryOpen) {
        setIsHeaderHidden(false);
        lastScrollY.current = window.scrollY;
        return;
      }

      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;

      if (currentScrollY < 96) {
        setIsHeaderHidden(false);
      } else if (delta > 8) {
        setIsHeaderHidden(true);
      } else if (delta < -8) {
        setIsHeaderHidden(false);
      }

      lastScrollY.current = currentScrollY;
    }

    let frame = 0;
    function handleScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        syncHeaderVisibility();
        frame = 0;
      });
    }

    syncHeaderVisibility();
    window.addEventListener("scroll", handleScroll, { passive: true });
    mediaQuery.addEventListener("change", syncHeaderVisibility);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      mediaQuery.removeEventListener("change", syncHeaderVisibility);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [menuOpen, categoryOpen]);

  return (
    <>
      <header
        className={`sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(15,23,42,0.08)] transition-transform duration-300 ease-out lg:transform-gpu lg:will-change-transform ${
          isHeaderHidden ? "lg:-translate-y-full" : "lg:translate-y-0"
        }`}
      >
        <div className="lg:hidden">
          <div className="relative flex h-[60px] items-center justify-between px-4">
            <button
              className="focus-ring grid size-10 place-items-center text-slate-950"
              type="button"
              aria-label="Mở menu"
              title="Mở menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={24} aria-hidden="true" />
            </button>
            <IdhubLogo
              size="sm"
              name={"Idhub"}
              tagline={settings["store.tagline"] ?? "Tài khoản số giá tốt"}
              className="focus-ring absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            />
            <button
              className="focus-ring grid size-10 place-items-center text-slate-950"
              type="button"
              aria-label="Tài khoản"
              title="Tài khoản"
              onClick={commerce.openAccount}
            >
              <UserRound size={24} aria-hidden="true" />
            </button>
          </div>
          <div className="bg-[#eaf8ef] px-4 py-2">
            <SearchBox compact />
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="mx-auto flex h-[80px] max-w-[1222px] items-center gap-7 px-[15px]">
            <IdhubLogo
              size="lg"
              name={settings["store.name"] ?? "Idhub"}
              tagline={settings["store.tagline"] ?? "Tài khoản số giá tốt"}
              className="focus-ring w-53.5 shrink-0"
            />

            <SearchBox />

            <div className="flex items-center gap-2">
              <Image src={zaloUrl} alt="Zalo" width={38} height={38} />
              <a
                className="whitespace-nowrap text-[15px] font-extrabold text-slate-950"
                href={phoneHref(hotline)}
              >
                {hotline}
              </a>
            </div>
          </div>

          <div className="h-[60px] bg-[#eaf8ef]">
            <div className="mx-auto flex h-full max-w-[1222px] items-center justify-between gap-5 px-[15px]">
              <div className="flex h-full items-center gap-5">
                <div
                  ref={categoryRef}
                  className="relative flex h-full items-center"
                  onMouseEnter={openCategory}
                  onMouseLeave={() => closeCategory(160)}
                >
                  <button
                    className={`focus-ring inline-flex h-[42px] w-[171px] cursor-pointer items-center gap-2.5 rounded-full bg-white pl-[3px] pr-3 text-[14px] font-extrabold leading-none shadow-sm transition-[color,box-shadow] duration-200 ${
                      categoryOpen
                        ? "text-[#15803d] shadow-[0_6px_16px_rgba(22,163,74,0.18)]"
                        : "text-slate-800"
                    }`}
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={categoryOpen}
                    aria-controls="ktk-category-menu"
                    onClick={openCategory}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#16a34a] text-white">
                      <Menu size={21} aria-hidden="true" />
                    </span>
                    <span className="whitespace-nowrap text-[13px]">Tất cả danh mục</span>
                  </button>

                  <div
                    id="ktk-category-menu"
                    className={`absolute left-0 top-full z-50 w-[274px] origin-top overflow-hidden rounded-b-[10px] border border-t-0 border-[#e5e7eb] bg-white py-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)] transition-[opacity,translate,visibility] duration-200 ease-out ${
                      categoryOpen
                        ? "visible translate-y-0 opacity-100"
                        : "invisible -translate-y-2 opacity-0"
                    }`}
                    aria-hidden={!categoryOpen}
                  >
                    {categoryMenuItems.map((item, index) => {
                      const Icon = item.icon;
                      const active = item.href === activeCategoryHref;
                      const hasChildren = item.children.length > 0;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          aria-haspopup={hasChildren ? "true" : undefined}
                          aria-expanded={hasChildren ? flyoutItem?.href === item.href : undefined}
                          className={`group flex h-[48px] items-center gap-3.5 px-5 text-[15px] font-bold transition-[opacity,translate,background-color,color] duration-200 ease-out hover:bg-[#f0faf4] hover:text-[#15803d] ${
                            active || flyoutItem?.href === item.href ? "bg-[#f0faf4] text-[#15803d]" : "text-slate-950"
                          } ${
                            categoryOpen
                              ? "translate-y-0 opacity-100"
                              : "-translate-y-1 opacity-0"
                          }`}
                          style={{
                            transitionDelay: categoryOpen ? `${index * 22}ms` : "0ms",
                          }}
                          tabIndex={categoryOpen ? undefined : -1}
                          onMouseEnter={(event) => { setFlyout(item.href); setFlyoutTop(event.currentTarget.offsetTop); }}
                          onFocus={(event) => { setFlyout(item.href); setFlyoutTop(event.currentTarget.offsetTop); }}
                          onClick={() => closeCategory()}
                        >
                          <Icon
                            size={22}
                            className={
                              active
                                ? "text-[#15803d]"
                                : "text-slate-950 transition-colors duration-200 group-hover:text-[#15803d]"
                            }
                            aria-hidden="true"
                          />
                          <span className="flex-1">{item.label}</span>
                          {hasChildren ? (
                            <ChevronRight size={16} className="shrink-0 text-slate-400 transition-colors group-hover:text-[#15803d]" aria-hidden="true" />
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>

                  {/* Second level: children of the hovered/focused root category. */}
                  {flyoutItem ? (
                    <div
                      className="absolute left-[274px] z-50 w-[300px] rounded-r-[10px] rounded-bl-[10px] border border-l-0 border-[#e5e7eb] bg-white py-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
                      style={{ top: `calc(100% + ${flyoutTop}px)` }}
                      role="group"
                      aria-label={`Danh mục con của ${flyoutItem.label}`}
                      onMouseEnter={openCategory}
                    >
                      <Link
                        href={flyoutItem.href}
                        className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-[#15803d] hover:underline"
                        onClick={() => closeCategory()}
                      >
                        <span className="truncate">{flyoutItem.label}</span>
                        <span className="shrink-0 text-[11px] font-bold normal-case tracking-normal text-slate-500">Xem tất cả</span>
                      </Link>
                      {flyoutItem.children.map((child) => {
                        const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            aria-current={childActive ? "page" : undefined}
                            className={`flex min-h-[42px] items-center gap-2.5 px-5 py-2 text-[14px] font-semibold leading-snug transition-colors hover:bg-[#f0faf4] hover:text-[#15803d] ${childActive ? "bg-[#f0faf4] text-[#15803d]" : "text-slate-800"}`}
                            onClick={() => closeCategory()}
                          >
                            <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <nav className="flex h-full items-center" aria-label="Liên kết nhanh">
                {navLinks.map((link) => {
                  const active =
                    pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "focus-ring group inline-flex h-[40px] items-center gap-2 px-2.75 text-[14px] font-bold text-[#15803d] transition"
                        : "focus-ring group inline-flex h-[40px] items-center gap-2 px-2.75 text-[14px] font-bold text-slate-700 transition hover:text-[#15803d]"
                    }
                  >
                    {link.icon ? (
                      <link.icon size={23} className="shrink-0" aria-hidden="true" />
                    ) : link.iconSrc ? (
                      <Image
                        src={link.iconSrc}
                        alt=""
                        width={28}
                        height={28}
                        sizes="28px"
                        className={
                          active
                            ? "ktk-nav-img-active size-7 shrink-0 object-contain"
                            : "ktk-nav-img-inactive size-7 shrink-0 object-contain"
                        }
                      />
                    ) : null}
                    {link.label}
                  </Link>
                  );
                })}
                </nav>
              </div>

              <div className="flex items-center gap-2">
                <HeaderIconButton label="Tài khoản" onClick={commerce.openAccount}>
                  <UserRound size={22} aria-hidden="true" />
                </HeaderIconButton>
                <HeaderIconButton
                  label="Yêu thích"
                  count={commerce.wishlistCount}
                  onClick={commerce.openWishlist}
                >
                  <Heart size={22} aria-hidden="true" />
                </HeaderIconButton>
                <HeaderIconButton
                  label="Giỏ hàng"
                  count={commerce.cartCount}
                  primary
                  onClick={commerce.openCart}
                >
                  <ShoppingCart size={22} aria-hidden="true" />
                </HeaderIconButton>
                <span className="text-[13px] font-extrabold text-slate-700">
                  {formatCurrency(commerce.subtotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/70"
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[300px] overflow-hidden bg-white shadow-2xl">
            <div className="flex h-[53px] items-center justify-center border-b-2 border-[#16a34a] text-[14px] font-extrabold uppercase text-slate-950">
              DANH MỤC
            </div>
            <div className="bg-white">
              {categoryMenuItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeCategoryHref;
                const isExpanded = expanded === item.href;

                return (
                  <div key={item.href} className="border-b border-[#e5e7eb]">
                    <div className="flex items-stretch">
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group flex h-[50px] min-w-0 flex-1 items-center gap-3 px-5 text-[16px] font-bold transition hover:text-[#15803d] ${
                          active ? "text-[#15803d]" : "text-slate-950"
                        }`}
                        onClick={() => setMenuOpen(false)}
                      >
                        <Icon
                          size={24}
                          className={
                            active
                              ? "text-[#15803d]"
                              : "shrink-0 text-slate-950 transition group-hover:text-[#15803d]"
                          }
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                      {item.children.length ? (
                        <button
                          type="button"
                          className="grid w-[50px] shrink-0 place-items-center border-l border-[#eef2f6] text-slate-500 transition hover:text-[#15803d]"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Thu gọn" : "Mở"} danh mục con của ${item.label}`}
                          onClick={() => setExpanded(isExpanded ? null : item.href)}
                        >
                          <ChevronDown size={18} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    {isExpanded ? (
                      <div className="bg-[#f8fbf9] py-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="flex min-h-[42px] items-center gap-2 py-2 pl-[52px] pr-5 text-[14px] font-semibold leading-snug text-slate-700 transition hover:text-[#15803d]"
                            onClick={() => setMenuOpen(false)}
                          >
                            <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HeaderIconButton({
  children,
  count,
  label,
  onClick,
  primary = false,
}: {
  children: ReactNode;
  count?: number;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      className={
        primary
          ? "focus-ring relative grid size-[43px] place-items-center rounded-full bg-primary text-white transition hover:bg-primary-strong"
          : "focus-ring relative grid size-[43px] place-items-center rounded-full bg-white text-slate-950 transition hover:text-primary-strong"
      }
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
      {typeof count === "number" ? (
        <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-white text-[11px] font-extrabold text-primary shadow-sm">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function SearchBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<ApiProduct[]>([]);

  // Debounced lookup against the API; short queries clear the list.
  useEffect(() => {
    const keyword = query.trim();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (keyword.length < 2) {
        setSuggestions([]);
        return;
      }
      catalogApi
        .listProducts({ search: keyword, limit: 6 })
        .then((page) => {
          if (!cancelled) setSuggestions(page.items);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, keyword.length < 2 ? 0 : 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = query.trim();
    if (keyword) {
      setFocused(false);
      router.push(`/tim-kiem?q=${encodeURIComponent(keyword)}`);
    }
  }

  return (
    <form
      action="/tim-kiem"
      method="get"
      className={
        compact
          ? "relative flex h-[44px] items-center rounded-full border border-[#d6dde8] bg-white px-4"
          : "relative flex h-[46px] flex-1 items-center rounded-full border border-[#d8e0ea] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.02)]"
      }
      onSubmit={submit}
    >
      <button
        className={compact ? "mr-2 text-primary" : "ml-4 mr-3 text-primary"}
        type="submit"
        aria-label="Tìm kiếm"
        title="Tìm kiếm"
      >
        <Search size={compact ? 20 : 21} aria-hidden="true" />
      </button>
      <input
        aria-label="Tìm kiếm sản phẩm"
        className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-medium text-slate-700 outline-none placeholder:text-slate-500"
        placeholder="Tìm sản phẩm ..."
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.form?.requestSubmit();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
      />
      {query ? (
        <button
          className={
            compact
              ? "grid size-8 shrink-0 place-items-center text-slate-400 transition hover:text-slate-600"
              : "mr-2 grid size-8 shrink-0 place-items-center text-slate-400 transition hover:text-slate-600"
          }
          type="button"
          aria-label="Xóa từ khóa tìm kiếm"
          title="Xóa từ khóa"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setQuery("")}
        >
          <X size={17} aria-hidden="true" />
        </button>
      ) : null}
      {focused && suggestions.length ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-md border border-border bg-white shadow-xl">
          {suggestions.map((product) => (
            <Link
              key={product.id}
              href={`/${product.slug}`}
              className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface-muted"
            >
              {product.featuredImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.featuredImage}
                  alt={product.name}
                  className="size-10 rounded-md object-cover"
                />
              ) : null}
              <span className="line-clamp-2 text-sm font-bold text-slate-800">
                {product.name}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </form>
  );
}
