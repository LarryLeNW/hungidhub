"use client";

import Image from "next/image";
import { useId, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Link2, LoaderCircle, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import styles from "../admin.module.css";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** Client-side guard mirroring the backend rules (type + 5 MB). Returns an error message or null. */
export function checkImageFile(file: File) {
  if (!ACCEPTED.includes(file.type)) return "Chỉ nhận ảnh JPG, PNG, WEBP, GIF hoặc AVIF.";
  if (file.size > MAX_IMAGE_BYTES) return `Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB) — tối đa 5 MB.`;
  return null;
}

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** Aspect ratio of the preview box, e.g. "1 / 1" or "16 / 9". */
  aspect?: string;
  hint?: string;
  /** Show the "dán URL" fallback for images hosted elsewhere. */
  allowUrl?: boolean;
  label?: string;
};

/**
 * Drop zone + file picker + paste target that uploads to `/admin/uploads/images`
 * and hands back the public URL. Shows the current image with replace/remove.
 */
export function ImageUploader({ value, onChange, aspect = "1 / 1", hint, allowUrl = true, label = "Ảnh" }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const result = await adminApi.uploadImage(file);
      onChange(result.url);
      setUrlMode(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tải ảnh thất bại.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files?.[0]);
  };

  const commitUrl = () => {
    const url = urlDraft.trim();
    if (url) onChange(url);
    setUrlDraft("");
    setUrlMode(false);
  };

  return (
    <div className={styles.uploader}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED.join(",")}
        hidden
        aria-label={`Chọn ${label.toLowerCase()}`}
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      {value.trim() ? (
        <div className={styles.uploaderPreview} style={{ aspectRatio: aspect }}>
          <Image src={value.trim()} alt={label} fill sizes="360px" className="object-cover" unoptimized />
          {uploading ? <div className={styles.uploaderBusy}><LoaderCircle size={20} className="animate-spin" /> Đang tải lên…</div> : null}
          <div className={styles.uploaderActions}>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}><RefreshCw size={14} /> Đổi ảnh</button>
            <button type="button" onClick={() => onChange("")} disabled={uploading} aria-label="Bỏ ảnh"><Trash2 size={14} /></button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`${styles.uploaderDrop} ${dragging ? styles.uploaderDropActive : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onPaste={(event) => {
            const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
            if (file) { event.preventDefault(); void upload(file); }
          }}
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }}
        >
          {uploading ? <LoaderCircle size={26} className="animate-spin" /> : dragging ? <UploadCloud size={28} /> : <ImagePlus size={26} />}
          <strong>{uploading ? "Đang tải lên…" : dragging ? "Thả để tải lên" : "Kéo thả ảnh vào đây hoặc bấm để chọn"}</strong>
          <span>{hint ?? "JPG, PNG, WEBP · tối đa 5 MB"}</span>
        </label>
      )}

      {error ? <p role="alert" className={styles.uploaderError}>{error}</p> : null}

      {allowUrl ? (
        urlMode ? (
          <div className={styles.uploaderUrl}>
            <input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="https://…/image.webp"
              aria-label="URL ảnh"
              autoFocus
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitUrl(); } if (event.key === "Escape") setUrlMode(false); }}
            />
            <button type="button" onClick={commitUrl}>Dùng</button>
            <button type="button" onClick={() => setUrlMode(false)}>Hủy</button>
          </div>
        ) : (
          <button type="button" className={styles.uploaderUrlToggle} onClick={() => setUrlMode(true)}><Link2 size={12} /> Hoặc dán URL ảnh có sẵn</button>
        )
      ) : null}
    </div>
  );
}
