import QRCode from "qrcode";
import { serverFetch } from "@/lib/api/server";
import { DEFAULT_PUBLIC_SETTINGS, zaloLinkFrom, type PublicSettings } from "@/lib/api/settings";

export type ZaloContact = {
  hotline: string;
  zaloLink: string;
  /** Data-URL of a QR code for the Zalo link. */
  zaloQr: string;
};

/** Zalo contact info + QR for the "liên hệ Zalo" popup, from fresh public settings. */
export async function getZaloContact(): Promise<ZaloContact> {
  const settings = await serverFetch<PublicSettings>("/settings/public");
  const merged = { ...DEFAULT_PUBLIC_SETTINGS, ...settings };
  const zaloLink = zaloLinkFrom(merged);
  const zaloQr = await QRCode.toDataURL(zaloLink, {
    width: 480,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  return { hotline: merged["store.hotline"], zaloLink, zaloQr };
}
