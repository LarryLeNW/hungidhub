"use client";

import Image from "next/image";
import { useEffect, type ReactNode } from "react";
import { Headphones, Phone, X } from "lucide-react";
import { phoneHref } from "@/lib/api/settings";

/**
 * Tạm thời (09/2026): thanh toán ngân hàng chưa được xử lý — mọi nút mua/thanh toán
 * mở popup này để hướng khách liên hệ Zalo. Gỡ các chỗ gọi khi checkout sẵn sàng.
 */
export function ZaloContactModal({
  open,
  onClose,
  zaloLink,
  hotline,
  zaloQr,
  message,
}: {
  open: boolean;
  onClose: () => void;
  zaloLink: string;
  hotline: string;
  /** Data-URL of a QR code for the Zalo link, generated server-side. */
  zaloQr?: string;
  message: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeWithEscape);
    return () => document.removeEventListener("keydown", closeWithEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-95 grid place-items-center bg-slate-950/55 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Liên hệ đặt hàng qua Zalo"
        className="relative w-full max-w-120 rounded-2xl bg-white p-7 text-center shadow-[0_28px_80px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="focus-ring absolute right-3 top-3 grid size-9 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Đóng"
          onClick={onClose}
        >
          <X size={19} aria-hidden="true" />
        </button>
        <span className="mx-auto grid size-16 place-items-center rounded-full border-2 border-[#dceaff] bg-white shadow-sm">
          <Image src="/icons/zalo.png" alt="Zalo" width={40} height={40} />
        </span>
        <h2 className="mt-4 text-[19px] font-extrabold text-slate-950">Đặt hàng qua Zalo</h2>
        <p className="mt-2 text-[14px] leading-6 text-slate-600">{message}</p>
        {zaloQr ? (
          <>
            <span className="mx-auto mt-5 block w-fit rounded-xl border border-border bg-white p-2 shadow-sm">
              <Image src={zaloQr} alt="Mã QR mở Zalo" width={164} height={164} className="rounded-lg" unoptimized />
            </span>
            <p className="mt-2 text-[12px] font-semibold text-slate-500">
              Quét mã bằng camera điện thoại để mở Zalo
            </p>
          </>
        ) : null}
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <a
            href={zaloLink}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex h-12 items-center justify-center gap-2.5 rounded-md bg-[#0068ff] font-extrabold text-white transition hover:brightness-110"
          >
            <span className="grid size-6 place-items-center rounded-full bg-white">
              <Image src="/icons/zalo.png" alt="" width={17} height={17} />
            </span>
            Chat Zalo ngay
          </a>
          <a
            href={phoneHref(hotline)}
            className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border font-extrabold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <Phone size={18} aria-hidden="true" />
            Gọi {hotline}
          </a>
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
          <Headphones size={14} aria-hidden="true" />
          Hỗ trợ 24/7 — phản hồi trong ít phút
        </p>
      </div>
    </div>
  );
}
