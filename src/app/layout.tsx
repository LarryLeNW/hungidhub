import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { CommerceProvider } from "@/components/commerce/commerce-provider";
import { SiteShell } from "@/components/layout/site-shell";
import { SettingsProvider } from "@/components/settings/settings-provider";
import { serverFetch } from "@/lib/api/server";
import { DEFAULT_PUBLIC_SETTINGS, type PublicSettings } from "@/lib/api/settings";
import { siteConfig } from "@/config/site";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await serverFetch<PublicSettings>("/settings/public");
  const name = settings?.["store.name"] || siteConfig.name;
  const description = settings?.["store.tagline"]
    ? `${name} — ${settings["store.tagline"]}. ${siteConfig.description}`
    : siteConfig.description;
  const domain = settings?.["store.domain"] || siteConfig.url;

  return {
    metadataBase: new URL(domain),
    icons: {
      icon: "/logo.png?v=2",
      shortcut: "/logo.png?v=2",
      apple: "/logo.png?v=2",
    },
    title: {
      default: name,
      template: `%s | ${name}`,
    },
    description,
    openGraph: {
      title: name,
      description,
      url: domain,
      siteName: name,
      locale: "vi_VN",
      type: "website",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await serverFetch<PublicSettings>("/settings/public");
  const mergedSettings = { ...DEFAULT_PUBLIC_SETTINGS, ...(settings || {}) };

  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <SettingsProvider settings={mergedSettings}>
          <AuthProvider>
            <WalletProvider>
              <CommerceProvider>
                <SiteShell settings={mergedSettings}>{children}</SiteShell>
              </CommerceProvider>
            </WalletProvider>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
