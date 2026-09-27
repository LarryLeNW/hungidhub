import { apiFetch } from "./client";

export type HomeSection = {
  key: string;
  title: string;
  subtitle?: string;
  tone?: "light" | "green";
  slugs: string[];
};

/** Keys exposed by `GET /settings/public` (see backend `DEFAULT_SETTINGS`). */
export type PublicSettings = {
  "store.name"?: string;
  "store.tagline"?: string;
  "store.hotline"?: string;
  "store.zalo"?: string;
  "store.email"?: string;
  "store.domain"?: string;
  "payment.methods"?: string[];
  "payment.min_deposit"?: number;
  "home.sections"?: HomeSection[];
};

/** Static fallbacks used when the API is unreachable. */
export const DEFAULT_PUBLIC_SETTINGS: Required<
  Pick<PublicSettings, "store.name" | "store.tagline" | "store.hotline" | "store.zalo" | "store.email">
> = {
  "store.name": "IDHUB",
  "store.tagline": "Tài khoản số giá tốt",
  "store.hotline": "0931 729 316",
  "store.zalo": "https://zalo.me/0931729316",
  "store.email": "larrylenw@gmail.com",
};

export const settingsApi = {
  getPublic: () => apiFetch<PublicSettings>("/settings/public", { auth: false }),
};

export function phoneHref(display: string) {
  return `tel:${display.replace(/\s/g, "")}`;
}

/** Zalo chat link from settings, falling back to a zalo.me URL built from the hotline. */
export function zaloLinkFrom(settings: PublicSettings) {
  const hotline = settings["store.hotline"] ?? DEFAULT_PUBLIC_SETTINGS["store.hotline"];
  return settings["store.zalo"] ?? `https://zalo.me/${hotline.replace(/\s/g, "")}`;
}
