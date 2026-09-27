"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { adminApi, type AdminContentBlock } from "@/lib/api/admin";
import styles from "../admin.module.css";
import { AdminModal, Field, FormError, fromDateInput, numberOrUndefined, toDateInput, useAsyncAction } from "./modal";
import { confirmDanger } from "./dialogs";

export function ContentBlockForm({ blockId, onClose, onSaved }: { blockId?: number; onClose: () => void; onSaved: (message: string) => void }) {
  const isEdit = typeof blockId === "number";
  const [loading, setLoading] = useState(isEdit);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AdminContentBlock["type"]>("banner");
  const [placement, setPlacement] = useState("home");
  const [imageUrl, setImageUrl] = useState("");
  const [mobileImageUrl, setMobileImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [body, setBody] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [status, setStatus] = useState<AdminContentBlock["status"]>("published");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const { pending, error, setError, run } = useAsyncAction();

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    adminApi
      .listContentBlocks({ limit: 100 })
      .then((page) => {
        if (!active) return;
        const block = page.items.find((item) => item.id === blockId);
        if (!block) throw new Error("Không tìm thấy nội dung.");
        setTitle(block.title);
        setType(block.type);
        setPlacement(block.placement);
        setImageUrl(block.imageUrl ?? "");
        setMobileImageUrl(block.mobileImageUrl ?? "");
        setLinkUrl(block.linkUrl ?? "");
        setBody(block.body ?? "");
        setSortOrder(String(block.sortOrder));
        setStatus(block.status);
        setStartsAt(toDateInput(block.startsAt));
        setEndsAt(toDateInput(block.endsAt));
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Không tải được nội dung."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [blockId, isEdit, setError]);

  async function save() {
    if (title.trim().length < 2) return setError("Tiêu đề tối thiểu 2 ký tự.");
    if (type === "banner" && !imageUrl.trim()) return setError("Banner cần ảnh (URL).");
    const input = {
      title: title.trim(),
      type,
      placement,
      imageUrl: imageUrl.trim() || undefined,
      mobileImageUrl: mobileImageUrl.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
      body: body.trim() || undefined,
      sortOrder: numberOrUndefined(sortOrder) ?? 0,
      status,
      startsAt: fromDateInput(startsAt),
      endsAt: fromDateInput(endsAt, true),
    };
    const result = await run(async () => {
      if (isEdit) {
        await adminApi.updateContentBlock(blockId, input);
        return `Đã lưu "${input.title}".`;
      }
      await adminApi.createContentBlock(input);
      return `Đã tạo "${input.title}".`;
    });
    if (result) onSaved(result);
  }

  async function remove() {
    if (!isEdit || !(await confirmDanger(`Xóa "${title}"?`, "Khối nội dung sẽ bị ẩn khỏi trang (xóa mềm)."))) return;
    const result = await run(async () => {
      await adminApi.deleteContentBlock(blockId);
      return `Đã xóa "${title}".`;
    });
    if (result) onSaved(result);
  }

  return (
    <AdminModal
      eyebrow={isEdit ? "NỘI DUNG" : "TẠO MỚI"}
      title={isEdit ? `Sửa: ${title || "…"}` : "Tạo nội dung"}
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
        <Field label="Tiêu đề" full><input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></Field>
        <Field label="Loại">
          <select value={type} onChange={(event) => setType(event.target.value as AdminContentBlock["type"])}>
            <option value="banner">Banner</option>
            <option value="announcement">Thông báo</option>
            <option value="help_article">Bài trợ giúp</option>
          </select>
        </Field>
        <Field label="Vị trí">
          <select value={placement} onChange={(event) => setPlacement(event.target.value)}>
            <option value="home">Trang chủ</option>
            <option value="global">Toàn hệ thống</option>
            <option value="help_center">Trung tâm trợ giúp</option>
            <option value="category">Trang danh mục</option>
            <option value="product">Trang sản phẩm</option>
          </select>
        </Field>
        <Field label="Ảnh (URL)" full hint="trang chủ: 3 ảnh đầu = carousel, ảnh 4 = mega, ảnh 5 = sale"><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" /></Field>
        <Field label="Ảnh mobile (URL)" full><input value={mobileImageUrl} onChange={(event) => setMobileImageUrl(event.target.value)} /></Field>
        <Field label="Liên kết khi bấm" full><input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="/tai-khoan-chatgpt-plus" /></Field>
        <Field label="Nội dung (HTML)" full><textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} /></Field>
        <Field label="Thứ tự"><input inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></Field>
        <Field label="Trạng thái">
          <select value={status} onChange={(event) => setStatus(event.target.value as AdminContentBlock["status"])}>
            <option value="published">Đang hiển thị</option>
            <option value="draft">Bản nháp</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </Field>
        <Field label="Hiển thị từ"><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field>
        <Field label="Đến"><input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></Field>
      </div>
      <FormError message={error} />
    </AdminModal>
  );
}
