"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { FloatingContactBar } from "@/components/layout/floating-contact-bar";
import { IntroSplash } from "@/components/layout/intro-splash";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { ApiCategory } from "@/lib/api/catalog";
import type { PublicSettings } from "@/lib/api/settings";
import { API_URL } from "@/lib/api/client";

type SiteShellClientProps = {
  children: ReactNode;
  categories: ApiCategory[];
  settings: PublicSettings;
};

export function SiteShellClient({ children, categories, settings }: SiteShellClientProps) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
    const storageKey = "idhub-traffic-session";
    let sessionId = sessionStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(storageKey, sessionId);
    }
    void fetch(`${API_URL}/analytics/page-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, path: pathname, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return children;
  }

  return (
    <div className="flex min-h-screen flex-col pb-[calc(68px+env(safe-area-inset-bottom))] lg:pb-0">
      <IntroSplash />
      <SiteHeader categories={categories} settings={settings} />
      <div className="flex-1">{children}</div>
      <SiteFooter categories={categories} settings={settings} />
      <FloatingContactBar settings={settings} />
      <ScrollToTopButton />
    </div>
  );
}
