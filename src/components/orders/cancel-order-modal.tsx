"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { ApiOrder } from "@/lib/api/orders";

const PRESET_REASONS = [
  "Đổi ý, không muốn mua nữa",
  "Đặt nhầm sản phẩm hoặc thời hạn",
  "Chưa tiện thanh toán lúc này",
  "Muốn chọn phương thức thanh toán khác",
  "Lý do khác",
] as const;

export type CancelOrderModalProps = {
  order: ApiOrder | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (order: ApiOrder, reason: string) => Promise<void>;
  loading: boolean;
  error?: string | null;
};

export function CancelOrderModal({
  order,
  open,
  onClose,
  onConfirm,
  loading,
  error,
}: CancelOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState("");

  // Reset state when opening a new order
  useEffect(() => {
    if (open) {
      setSelectedReason(PRESET_REASONS[0]);
      setCustomReason("");
    }
  }, [open, order?.code]);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open || !order) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason =
      selectedReason === "Lý do khác"
        ? customReason.trim() || "Khách hàng tự hủy"
        : selectedReason;
    void onConfirm(order, finalReason);
  };

  return (
    <div
      className="fixed inset-0 z-90 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-xs transition-opacity"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        className="relative w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          className="focus-ring absolute right-4 top-4 grid size-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <X size={18} />
          <span className="sr-only">Đóng</span>
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shadow-xs">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 id="cancel-modal-title" className="text-[17px] font-black text-slate-950">
              Hủy đơn hàng #{order.code}
            </h3>
            <p className="mt-1 text-[13px] text-muted leading-relaxed">
              Bạn có chắc chắn muốn hủy đơn hàng này? Hệ thống sẽ đóng đơn và ngừng tiếp nhận thanh toán.
            </p>
          </div>
        </div>

        {/* Mini Order Summary */}
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-[12.5px]">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span>Sản phẩm:</span>
            <span className="font-extrabold text-slate-900">
              {formatCurrency(order.total)}
            </span>
          </div>
          <p className="font-semibold text-slate-800 line-clamp-1">
            {order.items.map((i) => i.productName).join(", ")}
          </p>
        </div>

        {/* Reason Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-[12.5px] font-bold text-slate-700 mb-2">
              Lý do hủy đơn (tùy chọn):
            </label>
            <div className="space-y-1.5">
              {PRESET_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition ${
                    selectedReason === reason
                      ? "border-primary bg-emerald-50/40 text-slate-950 font-bold"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="accent-primary size-3.5"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {selectedReason === "Lý do khác" ? (
              <textarea
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập lý do của bạn..."
                className="mt-2 w-full rounded-lg border border-border p-2.5 text-[13px] text-slate-900 outline-none focus:border-primary"
              />
            ) : null}
          </div>

          {/* Error Message */}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12.5px] font-bold text-rose-700">
              {error}
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="mt-5 flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="focus-ring inline-flex h-9.5 cursor-pointer items-center justify-center rounded-xl border border-border bg-white px-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Giữ lại đơn
            </button>
            <button
              type="submit"
              disabled={loading}
              className="focus-ring inline-flex h-9.5 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-[13px] font-extrabold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle size={15} className="animate-spin" />
                  <span>Đang hủy…</span>
                </>
              ) : (
                <span>Xác nhận hủy đơn</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
