"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2 } from "lucide-react";
import { adminApi, type ApiFundRequest } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import styles from "../admin.module.css";
import { AdminModal, Field, FormError, useAsyncAction } from "./modal";

export function FundRequestDetail({ requestId, onClose, onChanged }: { requestId: number; onClose: () => void; onChanged: (message: string) => void }) {
  const [request, setRequest] = useState<ApiFundRequest | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const { pending, error, setError, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    adminApi
      .listFundRequests({ limit: 100 })
      .then((page) => {
        if (!active) return;
        const found = page.items.find((item) => item.id === requestId);
        if (!found) throw new Error("Không tìm thấy yêu cầu.");
        setRequest(found);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Không tải được yêu cầu.");
      });
    return () => {
      active = false;
    };
  }, [requestId, setError]);

  const open = request && (request.status === "pending" || request.status === "processing");

  return (
    <AdminModal eyebrow="NẠP & RÚT TIỀN" title={request ? `${request.code} · ${request.type === "deposit" ? "Nạp tiền" : "Rút tiền"}` : "…"} onClose={onClose} loading={!request && !error}>
      {request ? (
        <>
          <div className={styles.detailGrid}>
            <div><span>Tài khoản</span><strong>{request.user?.fullName ?? "—"}<br /><small>{request.user?.email}</small></strong></div>
            <div><span>Số tiền</span><strong>{formatCurrency(request.amount)}</strong></div>
            <div><span>Trạng thái</span><strong>{request.status}</strong></div>
            <div><span>Tạo lúc</span><strong>{formatDateTime(request.createdAt)}</strong></div>
            {request.type === "deposit" ? (
              <div><span>Nội dung CK khách phải ghi</span><strong><code>{request.transferContent}</code></strong></div>
            ) : (
              <div><span>Chuyển tới</span><strong>{request.bankName} · {request.bankAccountNumber}<br /><small>{request.bankAccountName}</small></strong></div>
            )}
            <div><span>Ghi chú</span><strong>{request.note || request.rejectReason || "—"}</strong></div>
          </div>
          {open ? (
            <div className={styles.formGrid}>
              <Field label="Ghi chú duyệt"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Đã nhận CK lúc…" /></Field>
              <Field label="Lý do từ chối"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Không thấy giao dịch…" /></Field>
            </div>
          ) : null}
          <FormError message={error} />
          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>Đóng</button>
            {open ? (
              <>
                <button type="button" className={styles.dangerButton} disabled={pending || reason.trim().length < 2} onClick={() => void run(async () => { await adminApi.rejectFundRequest(request.id, reason.trim()); onChanged(`${request.code} đã từ chối.`); })}><Ban size={16} /> Từ chối</button>
                <button type="button" className={styles.primaryButton} disabled={pending} onClick={() => void run(async () => { await adminApi.approveFundRequest(request.id, note.trim() || undefined); onChanged(`${request.code} đã duyệt, số dư khách đã cập nhật.`); })}><CheckCircle2 size={16} /> Duyệt</button>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <FormError message={error} />
      )}
    </AdminModal>
  );
}
