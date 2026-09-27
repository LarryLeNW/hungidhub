"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck, Unlock } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { roleLabels, type AuthUser } from "@/lib/api/auth";
import { formatDateTime } from "@/lib/dates";
import styles from "../admin.module.css";
import { AdminModal, FormError, useAsyncAction } from "./modal";
import { confirmAction } from "./dialogs";

export function CustomerDetail({ userId, onClose, onChanged }: { userId: number; onClose: () => void; onChanged: (message: string) => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const { pending, error, setError, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    adminApi
      .getUser(userId)
      .then((result) => {
        if (active) setUser(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Không tải được khách hàng.");
      });
    return () => {
      active = false;
    };
  }, [userId, setError]);

  async function toggleActive() {
    if (!user) return;
    const updated = await run(() => adminApi.setUserStatus(user.id, !user.isActive));
    if (updated) {
      setUser(updated);
      onChanged(updated.isActive ? `${updated.fullName} đã được mở khóa.` : `${updated.fullName} đã bị tạm khóa.`);
    }
  }

  async function toggleRole() {
    if (!user) return;
    const next = user.role === "admin" ? "customer" : "admin";
    if (!(await confirmAction(`${next === "admin" ? "Cấp quyền quản trị cho" : "Thu quyền quản trị của"} ${user.fullName}?`))) return;
    const updated = await run(() => adminApi.setUserRole(user.id, next));
    if (updated) {
      setUser(updated);
      onChanged(`${updated.fullName} giờ là ${roleLabels[updated.role]}.`);
    }
  }

  return (
    <AdminModal eyebrow="KHÁCH HÀNG" title={user?.fullName ?? "…"} onClose={onClose} loading={!user && !error}>
      {user ? (
        <>
          <div className={styles.detailGrid}>
            <div><span>Email</span><strong>{user.email}</strong></div>
            <div><span>Điện thoại</span><strong>{user.phone ?? "—"}</strong></div>
            <div><span>Vai trò</span><strong>{roleLabels[user.role]}</strong></div>
            <div><span>Trạng thái</span><strong>{user.isActive ? "Hoạt động" : "Tạm khóa"}</strong></div>
            <div><span>Đăng ký</span><strong>{formatDateTime(user.createdAt)}</strong></div>
            <div><span>Đăng nhập gần nhất</span><strong>{formatDateTime(user.lastLoginAt)}</strong></div>
          </div>
          <FormError message={error} />
          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>Đóng</button>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => void toggleRole()}><ShieldCheck size={16} /> {user.role === "admin" ? "Thu quyền admin" : "Cấp quyền admin"}</button>
            <button type="button" className={user.isActive ? styles.dangerButton : styles.primaryButton} disabled={pending} onClick={() => void toggleActive()}>{user.isActive ? <Lock size={16} /> : <Unlock size={16} />} {user.isActive ? "Tạm khóa" : "Mở khóa"}</button>
          </div>
        </>
      ) : (
        <FormError message={error} />
      )}
    </AdminModal>
  );
}
