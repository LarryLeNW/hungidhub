"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Heart, Home, Send, ShoppingCart, UserRound } from "lucide-react";
import { useCommerce } from "@/components/commerce/commerce-provider";
import { phoneHref, type PublicSettings } from "@/lib/api/settings";

const zaloUrl =
  "/icons/zalo.png";
const bottomNavItemClass =
  "relative flex h-full w-full flex-col items-center justify-center gap-1 text-center text-[10.5px] font-semibold leading-none transition-colors duration-150 active:scale-95";

/** App-style active indicator: a small pill on the item's top edge. */
function NavIndicator() {
  return <span className="absolute left-1/2 top-0 h-0.75 w-8 -translate-x-1/2 rounded-b-full bg-primary" aria-hidden="true" />;
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 py-0.5 text-[9px] font-extrabold leading-none text-white ring-2 ring-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function FloatingContactBar({ settings }: { settings: PublicSettings }) {
  const commerce = useCommerce();
  const pathname = usePathname();
  const activeItemClass = "font-bold text-primary-strong";
  const idleItemClass = "text-slate-500";
  const homeActive = pathname === "/" && !commerce.drawer;
  const blogActive = (pathname === "/blog" || pathname.startsWith("/blog/")) && !commerce.drawer;
  const hotline = settings["store.hotline"] ?? "0931 729 316";
  const zaloLink = settings["store.zalo"] ?? `https://zalo.me/${hotline.replace(/\s/g, "")}`;

  return (
    <>
      <div className="fixed bottom-6 right-4 z-50 hidden gap-3 lg:grid">
        <a
          className="grid size-[58px] place-items-center rounded-full bg-white shadow-[0_8px_28px_rgba(15,23,42,0.22)]"
          href={zaloLink}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat Zalo"
          title="Chat Zalo"
        >
          <span className="grid size-[42px] place-items-center rounded-full border-2 border-[#dceaff]">
            <Image src={zaloUrl} alt="Zalo" width={30} height={30} />
          </span>
        </a>
        <a
          className="grid size-[58px] place-items-center rounded-full bg-white shadow-[0_8px_28px_rgba(15,23,42,0.22)]"
          href={phoneHref(hotline)}
          aria-label={`Gọi ${hotline}`}
          title={`Gọi ${hotline}`}
        >
          <span className="grid size-[42px] place-items-center rounded-full bg-[#16a34a] text-white">
            <Send size={22} aria-hidden="true" />
          </span>
        </a>
      </div>

      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-90 grid h-[calc(68px+env(safe-area-inset-bottom))] grid-cols-5 rounded-t-2xl border-t border-[#e5e7eb] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(15,23,42,0.12)] lg:hidden">
        <Link
          className={`${bottomNavItemClass} ${homeActive ? activeItemClass : idleItemClass}`}
          href="/"
          onClick={commerce.closeDrawer}
          aria-current={homeActive ? "page" : undefined}
        >
          {homeActive && <NavIndicator />}
          <Home size={22} strokeWidth={homeActive ? 2.4 : 2} aria-hidden="true" />
          <span>Trang chủ</span>
        </Link>
        <button
          className={`${bottomNavItemClass} ${commerce.drawer === "wishlist" ? activeItemClass : idleItemClass}`}
          type="button"
          onClick={commerce.openWishlist}
        >
          {commerce.drawer === "wishlist" && <NavIndicator />}
          <span className="relative">
            <Heart size={22} strokeWidth={commerce.drawer === "wishlist" ? 2.4 : 2} aria-hidden="true" />
            <NavBadge count={commerce.wishlistCount} />
          </span>
          <span>Yêu thích</span>
        </button>
        <button
          className={`${bottomNavItemClass} ${commerce.drawer === "cart" ? "text-primary-strong" : "text-slate-600"}`}
          type="button"
          onClick={commerce.openCart}
          aria-label={`Giỏ hàng, ${commerce.cartCount} sản phẩm`}
        >
          <span className="absolute -top-5 left-1/2 grid size-13 -translate-x-1/2 place-items-center rounded-full bg-gradient-to-br from-[#22c55e] to-[#15803d] text-white shadow-[0_10px_24px_rgba(22,163,74,0.45)] ring-4 ring-white transition-transform duration-150 active:scale-95">
            <ShoppingCart size={23} aria-hidden="true" />
            <NavBadge count={commerce.cartCount} />
          </span>
          <span className="mt-8">Giỏ hàng</span>
        </button>
        <Link
          className={`${bottomNavItemClass} ${blogActive ? activeItemClass : idleItemClass}`}
          href="/blog"
          onClick={commerce.closeDrawer}
          aria-current={blogActive ? "page" : undefined}
        >
          {blogActive && <NavIndicator />}
          <FileText size={22} strokeWidth={blogActive ? 2.4 : 2} aria-hidden="true" />
          <span>Blog</span>
        </Link>
        <button
          className={`${bottomNavItemClass} ${commerce.drawer === "account" ? activeItemClass : idleItemClass}`}
          type="button"
          onClick={commerce.openAccount}
        >
          {commerce.drawer === "account" && <NavIndicator />}
          <UserRound size={22} strokeWidth={commerce.drawer === "account" ? 2.4 : 2} aria-hidden="true" />
          <span>Tài khoản</span>
        </button>
      </nav>
    </>
  );
}
