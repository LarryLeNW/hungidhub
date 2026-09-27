"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { adminApi, type ApiPromotion } from "@/lib/api/admin";
import styles from "../admin.module.css";
import { AdminModal, Field, FormError, fromDateInput, numberOrUndefined, toDateInput, useAsyncAction } from "./modal";
import { confirmDanger } from "./dialogs";

export function PromotionForm({ promotionId, onClose, onSaved }: { promotionId?: number; onClose: () => void; onSaved: (message: string) => void }) {
  const isEdit = typeof promotionId === "number";
  const [loading, setLoading] = useState(isEdit);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrderTotal, setMinOrderTotal] = useState("0");
  const [usageLimit, setUsageLimit] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState<ApiPromotion["status"]>("active");
  const [description, setDescription] = useState("");
  const [usageCount, setUsageCount] = useState(0);
  const { pending, error, setError, run } = useAsyncAction();

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    adminApi
      .getPromotion(promotionId)
      .then((promotion) => {
        if (!active) return;
        setName(promotion.name);
        setCode(promotion.code);
        setType(promotion.type);
        setValue(String(promotion.value));
        setMaxDiscount(promotion.maxDiscount?.toString() ?? "");
        setMinOrderTotal(String(promotion.minOrderTotal));
        setUsageLimit(promotion.usageLimit?.toString() ?? "");
        setPerUserLimit(promotion.perUserLimit?.toString() ?? "");
        setStartsAt(toDateInput(promotion.startsAt));
        setEndsAt(toDateInput(promotion.endsAt));
        setStatus(promotion.status);
        setDescription(promotion.description ?? "");
        setUsageCount(promotion.usageCount);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Không tải được khuyến mãi."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isEdit, promotionId, setError]);

  async function save() {
    const parsedValue = numberOrUndefined(value);
    if (name.trim().length < 2) return setError("Tên chiến dịch tối thiểu 2 ký tự.");
    if (!/^[A-Za-z0-9_-]{3,50}$/.test(code.trim())) return setError("Mã 3–50 ký tự chữ/số/-/_.");
    if (parsedValue === undefined || parsedValue <= 0) return setError("Giá trị ưu đãi phải > 0.");
    if (type === "percent" && parsedValue > 100) return setError("Phần trăm tối đa 100.");

    const input = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      type,
      value: parsedValue,
      maxDiscount: numberOrUndefined(maxDiscount),
      minOrderTotal: numberOrUndefined(minOrderTotal) ?? 0,
      usageLimit: numberOrUndefined(usageLimit),
      perUserLimit: numberOrUndefined(perUserLimit),
      startsAt: fromDateInput(startsAt),
      endsAt: fromDateInput(endsAt, true),
      status,
      description: description.trim() || undefined,
    };
    const result = await run(async () => {
      if (isEdit) {
        await adminApi.updatePromotion(promotionId, input);
        return `Đã lưu mã ${input.code}.`;
      }
      await adminApi.createPromotion(input);
      return `Đã tạo mã ${input.code}.`;
    });
    if (result) onSaved(result);
  }

  async function remove() {
    if (!isEdit || !(await confirmDanger(`Xóa mã ${code}?`, 'Mã đã có lượt dùng sẽ được chuyển sang "Đã kết thúc".'))) return;
    const result = await run(async () => {
      await adminApi.deletePromotion(promotionId);
      return `Đã xóa/kết thúc mã ${code}.`;
    });
    if (result) onSaved(result);
  }

  return (
    <AdminModal
      eyebrow={isEdit ? "KHUYẾN MÃI" : "TẠO MỚI"}
      title={isEdit ? `Sửa: ${code || "…"}` : "Tạo khuyến mãi"}
      onClose={onClose}
      loading={loading}
      footer={
        <>
          {isEdit ? <button type="button" className={styles.dangerButton} disabled={pending} onClick={() => void remove()}><Trash2 size={16} /> Xóa</button> : null}
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Hủy</button>
          <button type="button" className={styles.primaryButton} disabled={pending} onClick={() => void save()}><CheckCircle2 size={17} /> {pending ? "Đang lưu…" : "Lưu"}</button>
        </>
      }
    >
      <div className={styles.formGrid}>
        <Field label="Tên chiến dịch" full><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Khách hàng mới" autoFocus /></Field>
        <Field label="Mã"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Idhub10" /></Field>
        <Field label="Trạng thái">
          <select value={status} onChange={(event) => setStatus(event.target.value as ApiPromotion["status"])}>
            <option value="active">Đang chạy</option>
            <option value="scheduled">Đã lên lịch</option>
            <option value="paused">Tạm dừng</option>
            <option value="ended">Đã kết thúc</option>
          </select>
        </Field>
        <Field label="Loại ưu đãi">
          <select value={type} onChange={(event) => setType(event.target.value as "percent" | "fixed")}>
            <option value="percent">Giảm theo %</option>
            <option value="fixed">Giảm số tiền (VND)</option>
          </select>
        </Field>
        <Field label={type === "percent" ? "Phần trăm giảm" : "Số tiền giảm"}><input inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} /></Field>
        <Field label="Giảm tối đa (VND)" hint="chỉ áp dụng cho %"><input inputMode="numeric" value={maxDiscount} onChange={(event) => setMaxDiscount(event.target.value)} placeholder="không giới hạn" /></Field>
        <Field label="Đơn tối thiểu (VND)"><input inputMode="numeric" value={minOrderTotal} onChange={(event) => setMinOrderTotal(event.target.value)} /></Field>
        <Field label="Tổng lượt dùng" hint={isEdit ? `đã dùng ${usageCount}` : undefined}><input inputMode="numeric" value={usageLimit} onChange={(event) => setUsageLimit(event.target.value)} placeholder="không giới hạn" /></Field>
        <Field label="Lượt / khách"><input inputMode="numeric" value={perUserLimit} onChange={(event) => setPerUserLimit(event.target.value)} placeholder="không giới hạn" /></Field>
        <Field label="Bắt đầu"><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field>
        <Field label="Kết thúc"><input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></Field>
        <Field label="Mô tả" full><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      </div>
      <FormError message={error} />
    </AdminModal>
  );
}
