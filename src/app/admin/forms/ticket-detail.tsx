"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { adminApi, type AdminTicket } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/dates";
import styles from "../admin.module.css";
import { AdminModal, Field, FormError, useAsyncAction } from "./modal";

const statusOptions: [AdminTicket["status"], string][] = [
  ["new", "Mới"],
  ["in_progress", "Đang xử lý"],
  ["waiting_customer", "Chờ phản hồi"],
  ["resolved", "Đã giải quyết"],
  ["closed", "Đã đóng"],
];
const priorityOptions: [AdminTicket["priority"], string][] = [["low", "Thấp"], ["medium", "Trung bình"], ["high", "Cao"]];

export function TicketDetail({ ticketId, onClose, onChanged }: { ticketId: number; onClose: () => void; onChanged: (message: string) => void }) {
  const [ticket, setTicket] = useState<AdminTicket | null>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const { pending, error, setError, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    adminApi
      .getTicket(ticketId)
      .then((result) => {
        if (active) setTicket(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Không tải được phiếu.");
      });
    return () => {
      active = false;
    };
  }, [ticketId, setError]);

  async function sendReply() {
    if (reply.trim().length < 1) return;
    const updated = await run(() => adminApi.replyTicket(ticketId, reply.trim(), internal));
    if (updated) {
      setTicket(updated);
      setReply("");
      onChanged(internal ? "Đã lưu ghi chú nội bộ." : "Đã gửi phản hồi cho khách.");
    }
  }

  async function update(input: { status?: AdminTicket["status"]; priority?: AdminTicket["priority"] }) {
    const updated = await run(() => adminApi.updateTicket(ticketId, input));
    if (updated) {
      setTicket(updated);
      onChanged(`Đã cập nhật ${updated.code}.`);
    }
  }

  return (
    <AdminModal eyebrow="HỖ TRỢ" title={ticket ? `${ticket.code} · ${ticket.subject}` : "…"} onClose={onClose} wide loading={!ticket && !error}>
      {ticket ? (
        <>
          <div className={styles.detailGrid}>
            <div><span>Khách hàng</span><strong>{ticket.customerName}<br /><small>{ticket.customerEmail ?? "—"}</small></strong></div>
            <div><span>Đơn liên quan</span><strong>{ticket.order ? `#${ticket.order.code}` : "—"}</strong></div>
            <div>
              <span>Trạng thái</span>
              <select className={styles.inlineSelect} value={ticket.status} disabled={pending} onChange={(event) => void update({ status: event.target.value as AdminTicket["status"] })}>
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <span>Ưu tiên</span>
              <select className={styles.inlineSelect} value={ticket.priority} disabled={pending} onChange={(event) => void update({ priority: event.target.value as AdminTicket["priority"] })}>
                {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.thread}>
            {(ticket.messages ?? []).map((message) => (
              <div key={message.id} className={`${styles.threadMessage} ${message.authorType === "customer" ? styles.threadCustomer : styles.threadStaff} ${message.isInternal ? styles.threadInternal : ""}`}>
                <header>
                  <strong>{message.authorType === "customer" ? ticket.customerName : message.author?.fullName ?? "Nhân viên"}</strong>
                  {message.isInternal ? <em>ghi chú nội bộ</em> : null}
                  <time>{formatDateTime(message.createdAt)}</time>
                </header>
                <p>{message.body}</p>
              </div>
            ))}
          </div>

          <div className={styles.formGrid}>
            <Field label="Phản hồi" full><textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Nội dung trả lời khách…" /></Field>
            <Field label="Loại">
              <select value={internal ? "1" : "0"} onChange={(event) => setInternal(event.target.value === "1")}>
                <option value="0">Gửi cho khách</option>
                <option value="1">Ghi chú nội bộ</option>
              </select>
            </Field>
          </div>
          <FormError message={error} />
          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>Đóng</button>
            <button type="button" className={styles.primaryButton} disabled={pending || !reply.trim()} onClick={() => void sendReply()}><Send size={16} /> {internal ? "Lưu ghi chú" : "Gửi phản hồi"}</button>
          </div>
        </>
      ) : (
        <FormError message={error} />
      )}
    </AdminModal>
  );
}
