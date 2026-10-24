import type { ReactNode } from "react";
import { SiteShellClient } from "@/components/layout/site-shell-client";
import type { ApiCategory } from "@/lib/api/catalog";
import { serverFetch } from "@/lib/api/server";
import { DEFAULT_PUBLIC_SETTINGS, type PublicSettings } from "@/lib/api/settings";

type SiteShellProps = {
  children: ReactNode;
  settings?: PublicSettings | null;
};

/** Loads fresh navigation data and hands plain data to the client shell. */
export async function SiteShell({ children, settings: propSettings }: SiteShellProps) {
  const [categories, settings] = await Promise.all([
    serverFetch<ApiCategory[]>("/categories"),
    propSettings !== undefined ? Promise.resolve(propSettings) : serverFetch<PublicSettings>("/settings/public"),
  ]);

  return (
    <SiteShellClient categories={categories ?? []} settings={{ ...DEFAULT_PUBLIC_SETTINGS, ...(settings || {}) }}>
      {children}
    </SiteShellClient>
  );
}
