"use client";

import { useState } from "react";
import { Copy, CheckCircle2, KeyRound, Landmark, QrCode } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import {
  orderStatusLabels,
  paymentMethodLabels,
  type ApiOrder,
  type OrderStatus,
  type PaymentInstructions,
} from "@/lib/api/orders";

const statusTone: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  refunded: "bg-rose-50 text-rose-700 border-rose-200",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-extrabold ${statusTone[status]}`}
    >
      {orderStatusLabels[status]}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="focus-ring inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-white px-2 text-[11px] font-bold text-slate-600 hover:text-primary-strong"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable – value is still visible for manual copy
        }
      }}
    >
      {copied ? <CheckCircle2 size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {copied ? "Đã chép" : "Chép"}
    </button>
  );
}

function vietQrBankId(bankName: string) {
  const normalized = bankName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const bankIds: Record<string, string> = {
    acb: "acb",
    asiacommercialbank: "acb",
    vietcombank: "vcb",
    vcb: "vcb",
    techcombank: "tcb",
    tcb: "tcb",
    mbbank: "mb",
    mb: "mb",
    bidv: "bidv",
    vietinbank: "vietinbank",
    viettinbank: "vietinbank",
    vpbank: "vpbank",
    sacombank: "sacombank",
    tpbank: "tpbank",
    vib: "vib",
    msb: "msb",
    shb: "shb",
    hdbank: "hdbank",
    ocb: "ocb",
    eximbank: "eximbank",
    seabank: "seabank",
  };

  return bankIds[normalized] ?? normalized;
}

function vietQrImageUrl(instructions: PaymentInstructions) {
  const bankId = vietQrBankId(instructions.bankName);
  const accountNumber = instructions.accountNumber.replace(/\s/g, "");
  const params = new URLSearchParams({
    amount: String(Math.round(instructions.amount)),
    addInfo: instructions.transferContent,
    accountName: instructions.accountName,
  });

  return `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(
    accountNumber,
  )}-compact2.png?${params.toString()}`;
}

export function PaymentInstructionsCard({ instructions }: { instructions: PaymentInstructions }) {
  if (instructions.method === "zalo") {
    return (
      <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-[13px] leading-6 text-slate-700">
        <p className="font-extrabold text-slate-950">Xác nhận qua Zalo</p>
        <p>
          Nhắn Zalo <strong>0931 729 316</strong> kèm mã đơn <strong>{instructions.transferContent}</strong> để
          được hướng dẫn thanh toán {formatCurrency(instructions.amount)}.
        </p>
      </div>
    );
  }

  const qrUrl = vietQrImageUrl(instructions);
  const rows: [string, string, boolean?][] = [
    ["Ngân hàng", instructions.bankName],
    ["Số tài khoản", instructions.accountNumber, true],
    ["Chủ tài khoản", instructions.accountName],
    ["Số tiền", formatCurrency(instructions.amount), true],
    ["Nội dung CK", instructions.transferContent, true],
  ];

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
      <p className="inline-flex items-center gap-2 text-[14px] font-extrabold text-slate-950">
        <Landmark size={16} aria-hidden="true" />
        Chuyển khoản để hoàn tất đơn
      </p>
      <div className="mt-3 flex flex-col items-center gap-3 rounded-md border border-emerald-100 bg-white p-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt={`QR chuyển khoản ${instructions.bankName}`}
          className="h-52 w-52 rounded-md object-contain"
          loading="lazy"
        />
        <p className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-emerald-700">
          <QrCode size={14} aria-hidden="true" />
          Quét QR hoặc chuyển khoản thủ công theo thông tin bên dưới
        </p>
      </div>
      <dl className="mt-3 space-y-2 text-[13px]">
        {rows.map(([label, value, copyable]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-slate-600">{label}</dt>
            <dd className="flex items-center gap-2 font-extrabold text-slate-950">
              <span className="break-all text-right">{value}</span>
              {copyable ? (
                <CopyButton
                  value={label === "Số tiền" ? String(Math.round(instructions.amount)) : value}
                />
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] leading-5 text-slate-600">
        Ghi đúng nội dung chuyển khoản để hệ thống đối soát. Đơn được xử lý ngay sau khi nhận tiền.
      </p>
    </div>
  );
}

export function OrderSummary({ order, compact = false }: { order: ApiOrder; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold uppercase text-muted">Mã đơn</p>
          <p className="text-[20px] font-black text-slate-950">#{order.code}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        <dt className="text-muted">Ngày đặt</dt>
        <dd className="text-right font-bold text-slate-800">{formatDateTime(order.createdAt)}</dd>
        <dt className="text-muted">Thanh toán</dt>
        <dd className="text-right font-bold text-slate-800">{paymentMethodLabels[order.paymentMethod]}</dd>
        {!compact ? (
          <>
            <dt className="text-muted">Email nhận</dt>
            <dd className="truncate text-right font-bold text-slate-800">{order.customerEmail}</dd>
          </>
        ) : null}
      </dl>

      <ul className="divide-y divide-border rounded-md border border-border">
        {order.items.map((item) => (
          <li key={item.id} className="p-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-extrabold text-slate-950">{item.productName}</p>
                <p className="text-muted">
                  {[item.variantLabel, item.durationLabel].filter(Boolean).join(" · ")} × {item.quantity}
                </p>
              </div>
              <span className="shrink-0 font-extrabold text-slate-900">{formatCurrency(item.lineTotal)}</span>
            </div>

            {item.deliveryStatus === "delivered" ? (
              <div className="mt-2 rounded-md bg-slate-50 p-3">
                <p className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-emerald-700">
                  <KeyRound size={13} aria-hidden="true" />
                  Đã giao {item.deliveredAt ? formatDateTime(item.deliveredAt) : ""}
                </p>
                {item.inventoryItems?.map((unit) => (
                  <div key={unit.id} className="mt-1.5 flex items-center justify-between gap-2">
                    <code className="break-all rounded bg-white px-2 py-1 text-[12px] font-semibold text-slate-900">
                      {unit.payload}
                    </code>
                    <CopyButton value={unit.payload} />
                  </div>
                ))}
                {item.deliveryNote ? (
                  <p className="mt-1.5 whitespace-pre-line text-[12px] leading-5 text-slate-700">{item.deliveryNote}</p>
                ) : null}
                {item.warrantyUntil ? (
                  <p className="mt-1 text-[11px] text-muted">Bảo hành đến {formatDateTime(item.warrantyUntil)}</p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="space-y-1 text-[13px]">
        <div className="flex justify-between text-slate-600">
          <span>Tạm tính</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.discountTotal > 0 ? (
          <div className="flex justify-between text-emerald-700">
            <span>Giảm giá{order.promotionCode ? ` (${order.promotionCode})` : ""}</span>
            <span>−{formatCurrency(order.discountTotal)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-[15px] font-black text-slate-950">
          <span>Tổng cộng</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      {order.paymentInstructions ? <PaymentInstructionsCard instructions={order.paymentInstructions} /> : null}

      {order.status === "cancelled" && order.cancelReason ? (
        <p className="rounded-md bg-slate-100 p-3 text-[12px] text-slate-600">Lý do hủy: {order.cancelReason}</p>
      ) : null}
    </div>
  );
}
