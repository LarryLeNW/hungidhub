"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, RotateCcw, XCircle, AlertCircle, CheckCircle, Info } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { timeAgo, formatDateTime } from "@/lib/dates";
import {
  refundsApi,
  refundStatusLabels,
  refundMethodLabels,
  type ApiRefundRequest,
  type RefundRequestStatus,
} from "@/lib/api/refunds";

const statusTone: Record<RefundRequestStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

export function RefundStatusBadge({ status }: { status: RefundRequestStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-extrabold ${statusTone[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}
    >
      {refundStatusLabels[status] || status}
    </span>
  );
}

export function MyRefundRequests({
  onNavigate,
  limit = 10,
}: {
  onNavigate?: () => void;
  limit?: number;
}) {
  const [requests, setRequests] = useState<ApiRefundRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await refundsApi.listMine({ limit });
      setRequests(res.items);
    } catch {
      // If error or unauthenticated, ignore quietly
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRequests();
  }, [limit]);

  const handleCancel = async (id: number, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy yêu cầu hoàn tiền ${code}?`)) return;
    setCancellingId(id);
    setError(null);
    try {
      await refundsApi.cancelMine(id);
      setActionMsg(`Đã hủy yêu cầu hoàn tiền ${code}.`);
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hủy được yêu cầu.");
    } finally {
      setCancellingId(null);
    }
  };

  if (!loading && (!requests || requests.length === 0)) {
    return null;
  }

  return (
    <section className="mt-6 border-t border-slate-200/80 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase text-slate-700">
          <RotateCcw size={15} className="text-primary-strong" />
          Yêu cầu hoàn tiền ({requests?.length ?? 0})
        </h3>
      </div>

      {actionMsg && (
        <div className="mb-3 rounded-md bg-emerald-50 p-2.5 text-[12px] font-medium text-emerald-800 border border-emerald-200">
          {actionMsg}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md bg-rose-50 p-2.5 text-[12px] font-medium text-rose-800 border border-rose-200">
          {error}
        </div>
      )}

      {loading && !requests ? (
        <p className="inline-flex items-center gap-2 text-[13px] text-muted">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          Đang tải yêu cầu hoàn tiền…
        </p>
      ) : requests && requests.length > 0 ? (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li
              key={req.id}
              className="rounded-lg border border-border bg-slate-50/50 p-3.5 transition hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900">#{req.code}</span>
                  <RefundStatusBadge status={req.status} />
                </div>
                <span className="font-extrabold text-sky-700">
                  {formatCurrency(req.amount)}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-2">
                <div>
                  <span className="text-muted">Đơn hàng: </span>
                  <Link
                    href={`/kiem-tra-don-hang?code=${encodeURIComponent(req.order?.code || "")}`}
                    onClick={onNavigate}
                    className="font-bold text-primary-strong hover:underline"
                  >
                    #{req.order?.code || req.orderId}
                  </Link>
                </div>
                <div>
                  <span className="text-muted">Hình thức: </span>
                  <span className="font-semibold text-slate-800">
                    {refundMethodLabels[req.refundMethod] || req.refundMethod}
                  </span>
                </div>
                <div>
                  <span className="text-muted">Lý do: </span>
                  <span className="font-medium text-slate-800">{req.reason}</span>
                </div>
                <div>
                  <span className="text-muted">Thời gian gửi: </span>
                  <span className="text-slate-600">{timeAgo(req.createdAt)}</span>
                </div>
              </div>

              {req.adminNote && (
                <div className="mt-2 rounded bg-sky-50 px-2.5 py-1.5 text-[12px] text-sky-800 border border-sky-100 flex items-start gap-1.5">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Ghi chú từ quản trị viên: </span>
                    {req.adminNote}
                  </div>
                </div>
              )}

              {req.rejectReason && (
                <div className="mt-2 rounded bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800 border border-rose-100 flex items-start gap-1.5">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Lý do từ chối: </span>
                    {req.rejectReason}
                  </div>
                </div>
              )}

              {req.status === "pending" && (
                <div className="mt-3 flex justify-end border-t border-border/60 pt-2">
                  <button
                    type="button"
                    disabled={cancellingId === req.id}
                    onClick={() => handleCancel(req.id, req.code)}
                    className="cursor-pointer text-[12px] font-semibold text-rose-600 hover:text-rose-800 hover:underline disabled:opacity-50"
                  >
                    {cancellingId === req.id ? "Đang hủy…" : "Hủy yêu cầu hoàn tiền"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
