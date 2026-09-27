import Link from "next/link";
import { IdhubLogo } from "@/components/Idhub-logo";
import { siteConfig } from "@/config/site";
import type { ApiCategory } from "@/lib/api/catalog";
import { phoneHref, type PublicSettings } from "@/lib/api/settings";

const policyLinks = [
  { href: "/huong-dan-mua-hang", label: "Hướng dẫn mua hàng" },
  { href: "/bao-hanh-va-hoan-tien", label: "Bảo hành & hoàn tiền" },
  { href: "/chinh-sach-bao-mat", label: "Chính sách bảo mật" },
  { href: "/dieu-khoan-dich-vu", label: "Điều khoản dịch vụ" },
  { href: "/kiem-tra-don-hang", label: "Kiểm tra đơn hàng" },
];

export function SiteFooter({
  categories,
  settings,
}: {
  categories: ApiCategory[];
  settings: PublicSettings;
}) {
  const topLevel = categories.filter((category) => category.parentId === null).slice(0, 6);
  const name = settings["store.name"] ?? siteConfig.name;
  const email = settings["store.email"] ?? siteConfig.email;
  const hotline = settings["store.hotline"] ?? siteConfig.phone;

  return (
    <footer className="mt-10 border-t border-border bg-white">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <IdhubLogo size="md" name={name} />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted">
            {settings["store.tagline"] ? `${name} — ${settings["store.tagline"]}. ` : ""}
            {siteConfig.description}
          </p>
          <p className="mt-4 text-sm font-bold text-slate-700">
            Email:{" "}
            <a href={`mailto:${email}`} className="hover:text-primary-strong">
              {email}
            </a>
          </p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            Hotline:{" "}
            <a href={phoneHref(hotline)} className="hover:text-primary-strong">
              {hotline}
            </a>
          </p>
        </div>
        <div>
          <h3 className="font-extrabold text-slate-950">Danh mục</h3>
          <div className="mt-3 grid gap-2">
            {topLevel.map((category) => (
              <Link
                key={category.id}
                href={`/${category.path}`}
                className="text-sm font-semibold text-muted transition hover:text-primary-strong"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-extrabold text-slate-950">Chính sách</h3>
          <div className="mt-3 grid gap-2">
            {policyLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-muted transition hover:text-primary-strong"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
