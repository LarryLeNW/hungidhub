"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, X } from "lucide-react";
import styles from "../admin.module.css";

/** Escape to close, focus trap, body scroll lock — shared by every admin dialog. */
export function useDialogBehavior(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keys already consumed by an inner widget (e.g. an open SelectMenu handling Escape).
      if (event.defaultPrevented) return;
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return dialogRef;
}

export function AdminModal({
  eyebrow,
  title,
  onClose,
  children,
  footer,
  wide = false,
  loading = false,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  loading?: boolean;
}) {
  const dialogRef = useDialogBehavior(onClose);
  return (
    <div className={styles.modalLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={`${styles.modal} ${wide ? styles.modalWide : ""}`} role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
        <div className={styles.modalHeader}>
          <div><span>{eyebrow}</span><h2 id="admin-modal-title">{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </div>
        {loading ? (
          <div className={styles.modalLoading}><LoaderCircle size={22} className="animate-spin" /> Đang tải…</div>
        ) : (
          children
        )}
        {footer ? <div className={styles.modalActions}>{footer}</div> : null}
      </section>
    </div>
  );
}

/** Small helper to run an async action with pending/error state inside a form. */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setPending(true);
    setError(null);
    try {
      return await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Đã có lỗi xảy ra.");
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, setError, run };
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className={styles.inlineAlert} style={{ margin: "0 20px 12px" }}>{message}</p>;
}

/** `<label><span>…</span>{input}</label>` in the dashboard's form grid. */
export function Field({ label, full = false, hint, children }: { label: string; full?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={full ? styles.fullField : undefined}>
      <span>{label}{hint ? <em className={styles.fieldHint}> · {hint}</em> : null}</span>
      {children}
    </label>
  );
}

export function numberOrUndefined(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function fromDateInput(value: string, endOfDay = false) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`).toISOString();
}
