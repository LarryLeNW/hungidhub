"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, RotateCcw, X, Wallet, Building2 } from "lucide-react";
import { refundsApi, type RefundMethod } from "@/lib/api/refunds";
import type { ApiOrder } from "@/lib/api/orders";
import { formatCurrency } from "@/lib/format";

const REASON_OPTIONS = [
  "Sản phẩm lỗi, không đăng nhập hoặc sử dụng được",
  "Tài khoản bị mất quyền / bị khóa trước hạn",
  "Giao sai gói sản phẩm hoặc thời hạn",
  "Không nhận được thông tin đăng nhập",
  "Lý do khác",
];

export function RequestRefundModal({
  order,
  onClose,
  onSuccess,
}: {
  order: ApiOrder;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>(
    order.paymentMethod === "wallet" ? "wallet" : "bank_transfer",
  );
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState(order.customerName || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Vui lòng chọn hoặc nhập lý do hoàn tiền.");
      return;
    }

    if (refundMethod === "bank_transfer") {
      if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
        setError("Vui lòng nhập đầy đủ thông tin ngân hàng để nhận tiền hoàn.");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const res = await refundsApi.create({
        orderCode: order.code,
        customerEmail: order.customerEmail,
        reason,
        description: description.trim() || undefined,
        refundMethod,
        bankName: refundMethod === "bank_transfer" ? bankName.trim() : undefined,
        bankAccountNumber: refundMethod === "bank_transfer" ? bankAccountNumber.trim() : undefined,
        bankAccountName: refundMethod === "bank_transfer" ? bankAccountName.trim() : undefined,
      });

      onSuccess(`Đã gửi yêu cầu hoàn tiền #${res.code} thành công. Chúng tôi sẽ xử lý sớm nhất có thể.`);
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Gửi yêu cầu hoàn tiền thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label="Đóng"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <RotateCcw size={22} />
          </div>
          <div>
            <h3 id="refund-modal-title" className="text-lg font-bold text-white">
              Yêu cầu hoàn tiền
            </h3>
            <p className="text-xs text-slate-400">
              Đơn hàng <span className="font-semibold text-sky-400">#{order.code}</span> · {formatCurrency(order.total)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300">Lý do hoàn tiền</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Mô tả chi tiết <span className="text-slate-500 font-normal">(tùy chọn)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              placeholder="Mô tả cụ thể sự cố để bộ phận hỗ trợ kiểm tra và xử lý nhanh nhất..."
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">Hình thức nhận tiền hoàn</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRefundMethod("wallet")}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition ${
                  refundMethod === "wallet"
                    ? "border-sky-500 bg-sky-950/40 text-sky-200"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <Wallet size={16} className={refundMethod === "wallet" ? "text-sky-400" : "text-slate-500"} />
                <div>
                  <div className="font-semibold">Ví Idhub</div>
                  <div className="text-[10px] text-slate-400">Cộng tiền ngay khi duyệt</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRefundMethod("bank_transfer")}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition ${
                  refundMethod === "bank_transfer"
                    ? "border-sky-500 bg-sky-950/40 text-sky-200"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <Building2 size={16} className={refundMethod === "bank_transfer" ? "text-sky-400" : "text-slate-500"} />
                <div>
                  <div className="font-semibold">Ngân hàng</div>
                  <div className="text-[10px] text-slate-400">Chuyển khoản qua STK</div>
                </div>
              </button>
            </div>
          </div>

          {refundMethod === "bank_transfer" && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
              <div className="text-xs font-semibold text-slate-300">Thông tin tài khoản nhận tiền:</div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-400">Tên ngân hàng</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={loading}
                    placeholder="VD: Vietcombank, MB Bank, Techcombank..."
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400">Số tài khoản</label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    disabled={loading}
                    placeholder="Số tài khoản..."
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    disabled={loading}
                    placeholder="Họ và tên in hoa..."
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-900/30 transition hover:bg-rose-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  <span>Đang gửi…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Gửi yêu cầu hoàn tiền</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
