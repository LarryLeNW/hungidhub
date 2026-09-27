"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, PackageCheck, RotateCcw } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { orderStatusLabels, paymentMethodLabels, type ApiOrder } from "@/lib/api/orders";
import { formatDateTime } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import styles from "../admin.module.css";
import { AdminModal, Field, FormError, useAsyncAction } from "./modal";

export function OrderDetail({ orderId, onClose, onChanged }: { orderId: number; onClose: () => void; onChanged: (message: string) => void }) {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { pending, error, setError, run } = useAsyncAction();

  const load = () =>
    adminApi
      .getOrder(orderId)
      .then(setOrder)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Không tải được đơn."));

  useEffect(() => {
    let active = true;
    adminApi
      .getOrder(orderId)
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Không tải được đơn.");
      });
    return () => {
      active = false;
    };
  }, [orderId, setError]);

  async function act(action: () => Promise<unknown>, message: string) {
    const ok = await run(async () => {
      await action();
      return true;
    });
    if (ok) {
      await load();
      onChanged(message);
    }
  }

  const manualItems = order?.items.filter((item) => item.deliveryStatus !== "delivered") ?? [];

  return (
    <AdminModal eyebrow="ĐƠN HÀNG" title={order ? `#${order.code}` : "…"} onClose={onClose} wide loading={!order && !error}>
      {order ? (
        <>
          <div className={styles.detailGrid}>
            <div><span>Trạng thái</span><strong>{orderStatusLabels[order.status]}</strong></div>
            <div><span>Thanh toán</span><strong>{paymentMethodLabels[order.paymentMethod]}{order.paidAt ? ` · ${formatDateTime(order.paidAt)}` : ""}</strong></div>
            <div><span>Khách hàng</span><strong>{order.customerName}<br /><small>{order.customerEmail} · {order.customerPhone}</small></strong></div>
            <div><span>Tổng</span><strong>{formatCurrency(order.total)}{order.discountTotal ? <small> (giảm {formatCurrency(order.discountTotal)}{order.promotionCode ? ` · ${order.promotionCode}` : ""})</small> : null}</strong></div>
            <div><span>Đặt lúc</span><strong>{formatDateTime(order.createdAt)}</strong></div>
            <div><span>Ghi chú của khách</span><strong>{order.note || "—"}</strong></div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.formSectionHeader}><div><h3>Sản phẩm</h3><p>{order.items.length} dòng</p></div></div>
            <div className={styles.tableScroll}>
              <table className={styles.dataTable}>
                <thead><tr><th>Sản phẩm</th><th>Gói</th><th>SL</th><th>Thành tiền</th><th>Giao hàng</th></tr></thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.productName}</strong><small>{item.sku ?? ""}</small></td>
                      <td>{[item.variantLabel, item.durationLabel].filter(Boolean).join(" · ") || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.lineTotal)}</td>
                      <td>
                        {item.deliveryStatus === "delivered" ? (
                          <>
                            <span className={`${styles.status} ${styles.success}`}>Đã giao</span>
                            {item.inventoryItems?.map((unit) => <small key={unit.id} style={{ display: "block", marginTop: 4 }}><code>{unit.payload}</code></small>)}
                            {item.deliveryNote ? <small style={{ display: "block", marginTop: 4 }}>{item.deliveryNote}</small> : null}
                          </>
                        ) : order.status === "processing" ? (
                          <input className={styles.inlineInput} placeholder="Ghi chú giao (gói thủ công)" value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} />
                        ) : (
                          <span className={`${styles.status} ${styles.warning}`}>Chờ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {order.payments?.length ? (
            <div className={styles.formSection}>
              <div className={styles.formSectionHeader}><div><h3>Thanh toán</h3><p>Nội dung chuyển khoản: <code>{order.payments[0].transferContent ?? order.code}</code></p></div></div>
              <ul className={styles.plainList}>
                {order.payments.map((payment) => <li key={payment.id}>{paymentMethodLabels[payment.method]} · {formatCurrency(payment.amount)} · {payment.status}{payment.paidAt ? ` · ${formatDateTime(payment.paidAt)}` : ""}</li>)}
              </ul>
            </div>
          ) : null}

          <div className={styles.formGrid}>
            {order.status === "pending_payment" ? (
              <Field label="Mã giao dịch ngân hàng" hint="tuỳ chọn"><input value={transactionRef} onChange={(event) => setTransactionRef(event.target.value)} placeholder="ACB-12345" /></Field>
            ) : null}
            {order.status === "pending_payment" || order.status === "processing" || order.status === "completed" ? (
              <Field label="Lý do (khi hủy / hoàn tiền)"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Khách đổi ý, hết hàng…" /></Field>
            ) : null}
          </div>
          <FormError message={error} />
          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>Đóng</button>
            {order.status === "pending_payment" ? (
              <>
                <button type="button" className={styles.dangerButton} disabled={pending || reason.trim().length < 2} onClick={() => void act(() => adminApi.cancelOrder(order.id, reason.trim()), `#${order.code} đã hủy.`)}><Ban size={16} /> Hủy đơn</button>
                <button type="button" className={styles.primaryButton} disabled={pending} onClick={() => void act(() => adminApi.confirmPayment(order.id, transactionRef.trim() || undefined), `#${order.code} đã xác nhận thanh toán.`)}><CheckCircle2 size={16} /> Xác nhận đã thanh toán</button>
              </>
            ) : null}
            {order.status === "processing" ? (
              <>
                <button type="button" className={styles.dangerButton} disabled={pending || reason.trim().length < 2} onClick={() => void act(() => adminApi.cancelOrder(order.id, reason.trim()), `#${order.code} đã hủy và hoàn tiền (nếu trả bằng ví).`)}><Ban size={16} /> Hủy & hoàn tiền</button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={pending}
                  onClick={() => void act(
                    () => adminApi.completeOrder(order.id, Object.fromEntries(manualItems.filter((item) => notes[item.id]?.trim()).map((item) => [String(item.id), notes[item.id].trim()]))),
                    `#${order.code} đã hoàn tất và giao hàng.`,
                  )}
                ><PackageCheck size={16} /> Hoàn tất & giao hàng</button>
              </>
            ) : null}
            {order.status === "completed" ? (
              <button type="button" className={styles.dangerButton} disabled={pending || reason.trim().length < 2} onClick={() => void act(() => adminApi.refundOrder(order.id, reason.trim()), `#${order.code} đã hoàn tiền.`)}><RotateCcw size={16} /> Hoàn tiền</button>
            ) : null}
          </div>
        </>
      ) : (
        <FormError message={error} />
      )}
    </AdminModal>
  );
}
