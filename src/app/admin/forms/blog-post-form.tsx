"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { adminApi, type AdminPost, type PostInput } from "@/lib/api/admin";
import type { ApiPostCategory } from "@/lib/api/content";
import styles from "../admin.module.css";
import { AdminModal, Field, FormError, useAsyncAction } from "./modal";
import { ImageUploader } from "./image-uploader";
import { RichTextEditor } from "./rich-text-editor";
import { confirmDanger } from "./dialogs";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}

export function BlogPostForm({ postId, onClose, onSaved }: {
  postId?: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = typeof postId === "number";
  const [loading, setLoading] = useState(isEdit);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [status, setStatus] = useState<AdminPost["status"]>("draft");
  const [categories, setCategories] = useState<ApiPostCategory[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const { pending, error, setError, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    Promise.all([adminApi.listPostCategories(), isEdit ? adminApi.getPost(postId) : Promise.resolve(null)])
      .then(([categoryList, post]) => {
        if (!active) return;
        setCategories(categoryList);
        if (post) {
          setTitle(post.title);
          setSlug(post.slug);
          setSlugTouched(true);
          setExcerpt(post.excerpt ?? "");
          setContentHtml(post.contentHtml ?? "");
          setFeaturedImage(post.featuredImage ?? "");
          setStatus(post.status);
          setCategoryIds(post.categories.map((category) => category.id));
          setSeoTitle(post.seoTitle ?? "");
          setSeoDescription(post.seoDescription ?? "");
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Không tải được bài viết."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isEdit, postId, setError]);

  async function save() {
    if (title.trim().length < 2) return setError("Tiêu đề tối thiểu 2 ký tự.");
    if (!slugify(slug || title)) return setError("Đường dẫn bài viết không hợp lệ.");
    const input: PostInput = {
      title: title.trim(), slug: slugify(slug || title), excerpt: excerpt.trim() || undefined,
      contentHtml: contentHtml.trim() || undefined, featuredImage: featuredImage.trim() || undefined,
      status, categoryIds, seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
    };
    const result = await run(async () => {
      if (isEdit) await adminApi.updatePost(postId, input);
      else await adminApi.createPost(input);
      return isEdit ? `Đã lưu “${input.title}”.` : `Đã tạo bài viết “${input.title}”.`;
    });
    if (result) onSaved(result);
  }

  async function remove() {
    if (!isEdit || !(await confirmDanger(`Xóa “${title}”?`, "Bài viết sẽ bị xóa khỏi blog."))) return;
    const result = await run(async () => { await adminApi.deletePost(postId); return `Đã xóa “${title}”.`; });
    if (result) onSaved(result);
  }

  return (
    <AdminModal eyebrow={isEdit ? "BLOG" : "BÀI VIẾT MỚI"} title={isEdit ? `Sửa: ${title || "…"}` : "Tạo bài blog"}
      onClose={onClose} wide loading={loading}
      footer={<>{isEdit ? <button type="button" className={styles.dangerButton} disabled={pending} onClick={() => void remove()}><Trash2 size={16} /> Xóa</button> : null}<button type="button" className={styles.secondaryButton} onClick={onClose}>Hủy</button><button type="button" className={styles.primaryButton} disabled={pending} onClick={() => void save()}><CheckCircle2 size={17} /> {pending ? "Đang lưu…" : "Lưu bài viết"}</button></>}>
      <div className={styles.formGrid}>
        <Field label="Tiêu đề" full><input value={title} autoFocus onChange={(event) => { const value = event.target.value; setTitle(value); if (!slugTouched) setSlug(slugify(value)); }} /></Field>
        <Field label="Đường dẫn" hint="slug"><input value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }} placeholder="huong-dan-su-dung" /></Field>
        <Field label="Trạng thái"><select value={status} onChange={(event) => setStatus(event.target.value as AdminPost["status"])}><option value="draft">Bản nháp</option><option value="published">Đăng ngay</option><option value="archived">Lưu trữ</option></select></Field>
        <Field label="Mô tả ngắn" full><textarea rows={3} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} /></Field>
        <Field label="Ảnh đại diện" full><ImageUploader value={featuredImage} onChange={setFeaturedImage} aspect="16 / 9" label="Ảnh đại diện bài viết" /></Field>
        <Field label="Chuyên mục" full>
          <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 p-3">
            {categories.length ? categories.map((category) => {
              const selected = categoryIds.includes(category.id);
              return <button key={category.id} type="button" aria-pressed={selected} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${selected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`} onClick={() => setCategoryIds((ids) => selected ? ids.filter((id) => id !== category.id) : [...ids, category.id])}>{category.name}</button>;
            }) : <span className="text-sm text-slate-500">Chưa có chuyên mục blog.</span>}
          </div>
        </Field>
        <Field label="Nội dung" full><RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="Viết nội dung bài blog…" minHeight={420} /></Field>
        <Field label="SEO title"><input value={seoTitle} maxLength={255} onChange={(event) => setSeoTitle(event.target.value)} /></Field>
        <Field label="SEO description"><textarea rows={2} value={seoDescription} maxLength={500} onChange={(event) => setSeoDescription(event.target.value)} /></Field>
      </div>
      <FormError message={error} />
    </AdminModal>
  );
}
