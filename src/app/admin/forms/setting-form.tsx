"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { adminApi, type AdminSetting } from "@/lib/api/admin";
import styles from "../admin.module.css";
import { AdminModal, Field, FormError, useAsyncAction } from "./modal";

export function SettingForm({ settingKey, onClose, onSaved }: { settingKey: string; onClose: () => void; onSaved: (message: string) => void }) {
  const isReadOnly = settingKey === "payment.bank";
  const [loading, setLoading] = useState(true);
  const [setting, setSetting] = useState<AdminSetting | null>(null);
  const [mode, setMode] = useState<"text" | "number" | "boolean" | "json">("text");
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const { pending, error, setError, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    adminApi
      .listSettings()
      .then((items) => {
        if (!active) return;
        const found = items.find((item) => item.key === settingKey);
        if (!found) throw new Error("Không tìm thấy cài đặt.");
        setSetting(found);
        setDescription(found.description ?? "");
        setIsPublic(found.isPublic);
        const value = found.value;
        if (typeof value === "string") { setMode("text"); setText(value); }
        else if (typeof value === "number") { setMode("number"); setText(String(value)); }
        else if (typeof value === "boolean") { setMode("boolean"); setText(value ? "true" : "false"); }
        else { setMode("json"); setText(JSON.stringify(value ?? null, null, 2)); }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Không tải được cài đặt."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [settingKey, setError]);

  async function save() {
    if (isReadOnly) {
      setError("Thông tin tài khoản ngân hàng được cấu hình cố định theo hệ thống và không cho phép chỉnh sửa.");
      return;
    }
    let value: unknown = text;
    if (mode === "number") {
      value = Number(text);
      if (!Number.isFinite(value)) return setError("Giá trị phải là số.");
    } else if (mode === "boolean") {
      value = text === "true";
    } else if (mode === "json") {
      try {
        value = JSON.parse(text);
      } catch {
        return setError("JSON không hợp lệ.");
      }
    }
    const result = await run(async () => {
      await adminApi.updateSetting(settingKey, { value, description: description.trim() || undefined, isPublic });
      return `Đã lưu cài đặt ${settingKey}.`;
    });
    if (result) onSaved(result);
  }

  return (
    <AdminModal
      eyebrow="CÀI ĐẶT"
      title={description || settingKey}
      onClose={onClose}
      loading={loading}
      footer={
        isReadOnly ? (
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Đóng
          </button>
        ) : (
          <>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>Hủy</button>
            <button type="button" className={styles.primaryButton} disabled={pending} onClick={() => void save()}><CheckCircle2 size={17} /> {pending ? "Đang lưu…" : "Lưu"}</button>
          </>
        )
      }
    >
      {isReadOnly && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            color: "#92400e",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Lock size={16} style={{ flexShrink: 0 }} />
          <span>
            Tài khoản ngân hàng là cấu hình cố định của hệ thống. Bạn chỉ có thể xem, không được phép chỉnh sửa.
          </span>
        </div>
      )}
      <div className={styles.formGrid}>
        <Field label="Mô tả" full>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isReadOnly}
            style={isReadOnly ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
          />
        </Field>
        <Field label={mode === "json" ? "Giá trị (JSON)" : "Giá trị"} full hint={setting ? `nhóm: ${setting.group}` : undefined}>
          {mode === "json" ? (
            <textarea
              rows={10}
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              disabled={isReadOnly}
              style={{ fontFamily: "ui-monospace, monospace", ...(isReadOnly ? { opacity: 0.7, cursor: "not-allowed" } : {}) }}
            />
          ) : mode === "boolean" ? (
            <select
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={isReadOnly}
              style={isReadOnly ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
            >
              <option value="true">Bật</option>
              <option value="false">Tắt</option>
            </select>
          ) : (
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              inputMode={mode === "number" ? "numeric" : undefined}
              disabled={isReadOnly}
              style={isReadOnly ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
            />
          )}
        </Field>
        <Field label="Phạm vi" hint="công khai = storefront đọc được">
          <select
            value={isPublic ? "1" : "0"}
            onChange={(event) => setIsPublic(event.target.value === "1")}
            disabled={isReadOnly}
            style={isReadOnly ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
          >
            <option value="0">Nội bộ</option>
            <option value="1">Công khai</option>
          </select>
        </Field>
      </div>
      <FormError message={error} />
    </AdminModal>
  );
}
