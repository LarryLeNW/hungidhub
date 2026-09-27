"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { adminApi, type AdminCategory } from "@/lib/api/admin";
import styles from "../admin.module.css";
import { AdminModal, Field, FormError, numberOrUndefined, useAsyncAction } from "./modal";
import { ImageUploader } from "./image-uploader";
import { SelectMenu } from "./select-menu";
import { confirmDanger } from "./dialogs";

const ICONS = ["Bot", "GraduationCap", "Laptop", "Headphones", "ShieldCheck", "Wrench", "Gamepad2", "Tags"];

function flatten(nodes: AdminCategory[], depth = 0): (AdminCategory & { depth: number })[] {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children ?? [], depth + 1)]);
}

export function CategoryForm({ categoryId, onClose, onSaved }: { categoryId?: number; onClose: () => void; onSaved: (message: string) => void }) {
  const isEdit = typeof categoryId === "number";
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState<(AdminCategory & { depth: number })[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isVisible, setIsVisible] = useState(true);
  const { pending, error, setError, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    adminApi
      .listCategories()
      .then((tree) => {
        if (!active) return;
        const flat = flatten(tree);
        setAll(flat);
        const current = isEdit ? flat.find((node) => node.id === categoryId) : undefined;
        if (current) {
          setName(current.name);
          setSlug(current.slug);
          setParentId(current.parentId ? String(current.parentId) : "");
          setIcon(current.icon ?? "");
          setDescription(current.description ?? "");
          setImageUrl(current.imageUrl ?? "");
          setSortOrder(String(current.sortOrder));
          setIsVisible(current.isVisible);
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Không tải được danh mục."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [categoryId, isEdit, setError]);

  async function save() {
    if (name.trim().length < 2) {
      setError("Tên danh mục tối thiểu 2 ký tự.");
      return;
    }
    const input = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      parentId: parentId ? Number(parentId) : null,
      icon: icon || undefined,
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      sortOrder: numberOrUndefined(sortOrder) ?? 0,
      isVisible,
    };
    const result = await run(async () => {
      if (isEdit) {
        await adminApi.updateCategory(categoryId, input);
        return `Đã lưu danh mục "${input.name}".`;
      }
      await adminApi.createCategory(input);
      return `Đã tạo danh mục "${input.name}".`;
    });
    if (result) onSaved(result);
  }

  async function remove() {
    if (!isEdit || !(await confirmDanger(`Xóa danh mục "${name}"?`, "Danh mục con phải được chuyển đi trước. Bản ghi sẽ bị ẩn (xóa mềm)."))) return;
    const result = await run(async () => {
      await adminApi.deleteCategory(categoryId);
      return `Đã xóa danh mục "${name}".`;
    });
    if (result) onSaved(result);
  }

  return (
    <AdminModal
      eyebrow={isEdit ? "DANH MỤC" : "TẠO MỚI"}
      title={isEdit ? `Sửa: ${name || "…"}` : "Thêm danh mục"}
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
        <Field label="Tên danh mục" full><input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></Field>
        <Field label="Slug" hint="để trống sẽ tự tạo"><input value={slug} onChange={(event) => setSlug(event.target.value)} /></Field>
        <Field label="Danh mục cha">
          <SelectMenu
            value={parentId}
            onChange={setParentId}
            options={[
              { value: "", label: "Cấp cao nhất" },
              ...all.filter((node) => node.id !== categoryId).map((node) => ({ value: String(node.id), label: node.name, depth: node.depth + 1 })),
            ]}
          />
        </Field>
        <Field label="Icon menu">
          <SelectMenu value={icon} onChange={setIcon} options={[{ value: "", label: "Không dùng icon" }, ...ICONS.map((value) => ({ value, label: value }))]} />
        </Field>
        <Field label="Thứ tự"><input inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></Field>
        <div className={`${styles.fullField} ${styles.fieldBlock}`}>
          <span>Ảnh danh mục<em className={styles.fieldHint}> · hiện ở đầu trang danh mục</em></span>
          <ImageUploader value={imageUrl} onChange={setImageUrl} aspect="16 / 7" label="Ảnh danh mục" />
        </div>
        <Field label="Mô tả" full><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <Field label="Hiển thị trên cửa hàng">
          <SelectMenu value={isVisible ? "1" : "0"} onChange={(value) => setIsVisible(value === "1")} options={[{ value: "1", label: "Hiển thị" }, { value: "0", label: "Ẩn" }]} />
        </Field>
      </div>
      <FormError message={error} />
    </AdminModal>
  );
}
