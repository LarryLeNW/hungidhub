"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code2,
  Eraser,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  LoaderCircle,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import styles from "../admin.module.css";
import { checkImageFile } from "./image-uploader";
import { promptText } from "./dialogs";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Minimum height of the writing surface, in px. */
  minHeight?: number;
};

type Mode = "visual" | "html";
type InsertImages = (files: Iterable<File>, position?: number) => Promise<void>;

const imageFiles = (list: FileList | File[] | null | undefined) => Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));

/**
 * WYSIWYG editor for product/page content. Produces plain semantic HTML
 * (h2/h3/p/ul/ol/blockquote/a/img/hr) – exactly what `ContentBody` renders on
 * the storefront – and previews it with the storefront's own `.wp-content` styles.
 * Images are uploaded (toolbar button, drag & drop, paste) and inserted by URL.
 */
export function RichTextEditor({ value, onChange, placeholder = "Viết nội dung mô tả sản phẩm…", minHeight = 320 }: Props) {
  const [mode, setMode] = useState<Mode>("visual");
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // ProseMirror's drop/paste handlers are created once; they reach the latest inserter through this ref.
  const insertRef = useRef<InsertImages>(async () => {});

  const editor = useEditor({
    // Required in Next.js: render on the client only, so SSR markup never mismatches.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener" } },
        codeBlock: false,
      }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: { class: "wp-content", spellcheck: "false", "aria-label": "Nội dung chi tiết" },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        const drop = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void insertRef.current(files, drop?.pos);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        void insertRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? "" : current.getHTML()),
  });

  // Push external changes (async product load, edits made in HTML mode) into the editor.
  useEffect(() => {
    if (!editor || mode !== "visual") return;
    const next = value || "";
    if (editor.getHTML() === next || (editor.isEmpty && !next)) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value, mode]);

  useEffect(() => {
    insertRef.current = async (files, position) => {
      if (!editor) return;
      for (const file of files) {
        const problem = checkImageFile(file);
        if (problem) {
          setUploadError(problem);
          continue;
        }
        setUploadError(null);
        setUploading((count) => count + 1);
        try {
          const { url } = await adminApi.uploadImage(file);
          // Insert after the current selection and move the caret past the image, so consecutive
          // uploads land one after another instead of replacing the (auto-selected) previous image.
          const pos = typeof position === "number" ? position : editor.state.selection.to;
          editor
            .chain()
            .focus()
            .insertContentAt(pos, { type: "image", attrs: { src: url, alt: file.name.replace(/\.[^.]+$/, "") } })
            .setTextSelection(pos + 1)
            .run();
        } catch (caught) {
          setUploadError(caught instanceof Error ? caught.message : "Tải ảnh thất bại.");
        } finally {
          setUploading((count) => count - 1);
        }
      }
    };
  }, [editor]);

  const note = uploadError
    ? { text: uploadError, tone: "error" as const }
    : uploading
      ? { text: `Đang tải ${uploading} ảnh lên…`, tone: "busy" as const }
      : mode === "html"
        ? { text: "Sửa HTML trực tiếp — chuyển lại “Soạn thảo” để xem kết quả.", tone: "muted" as const }
        : null;

  return (
    <div className={styles.rte}>
      <div className={styles.rteToolbar}>
        {mode === "visual" && editor ? <Toolbar editor={editor} onInsertImages={(files) => void insertRef.current(files)} /> : <span className={styles.rteToolbarNote}>{mode === "html" ? "Chế độ HTML" : "Đang tải trình soạn thảo…"}</span>}
        <div className={styles.rteModes} role="radiogroup" aria-label="Chế độ soạn thảo">
          <button type="button" role="radio" aria-checked={mode === "visual"} className={mode === "visual" ? styles.rteModeOn : ""} onClick={() => setMode("visual")}><Pilcrow size={13} /> Soạn thảo</button>
          <button type="button" role="radio" aria-checked={mode === "html"} className={mode === "html" ? styles.rteModeOn : ""} onClick={() => setMode("html")}><Code2 size={13} /> HTML</button>
        </div>
      </div>

      {note ? (
        <p className={`${styles.rteNote} ${note.tone === "error" ? styles.rteNoteError : note.tone === "busy" ? styles.rteNoteBusy : ""}`} role={note.tone === "error" ? "alert" : "status"}>
          {note.tone === "busy" ? <LoaderCircle size={13} className="animate-spin" /> : null}
          {note.text}
        </p>
      ) : null}

      {mode === "html" ? (
        <textarea
          className={styles.rteSource}
          style={{ minHeight }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={"<h2>Giới thiệu</h2>\n<p>…</p>"}
          spellCheck={false}
          aria-label="Nội dung chi tiết (HTML)"
        />
      ) : (
        <div className={styles.rteSurface} style={{ minHeight }} onClick={() => editor?.commands.focus()}>
          {editor ? <EditorContent editor={editor} /> : <p className={styles.rteLoading}><LoaderCircle size={16} className="animate-spin" /> Đang tải…</p>}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, onInsertImages }: { editor: Editor; onInsertImages: (files: File[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  // `useEditorState` re-renders only when the selected flags change (TipTap v3 no longer re-renders on every transaction).
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      paragraph: current.isActive("paragraph"),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      link: current.isActive("link"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const setLink = async () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = await promptText({ title: "Chèn liên kết", text: "Để trống để bỏ liên kết.", initial: previous ?? "https://", placeholder: "https://…", confirmText: "Áp dụng" });
    if (href === null) return;
    const trimmed = href.trim();
    if (!trimmed || trimmed === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  return (
    <div className={styles.rteButtons}>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        hidden
        aria-label="Chọn ảnh chèn vào nội dung"
        onChange={(event) => {
          onInsertImages(imageFiles(event.target.files));
          event.target.value = "";
        }}
      />
      <Group>
        <Btn label="Đoạn văn" on={state.paragraph} onClick={() => editor.chain().focus().setParagraph().run()}><Pilcrow size={15} /></Btn>
        <Btn label="Tiêu đề lớn (H2)" on={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></Btn>
        <Btn label="Tiêu đề nhỏ (H3)" on={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></Btn>
      </Group>
      <Group>
        <Btn label="Đậm (Ctrl+B)" on={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></Btn>
        <Btn label="Nghiêng (Ctrl+I)" on={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></Btn>
        <Btn label="Gạch chân (Ctrl+U)" on={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={15} /></Btn>
        <Btn label="Gạch ngang" on={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></Btn>
      </Group>
      <Group>
        <Btn label="Danh sách chấm" on={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></Btn>
        <Btn label="Danh sách số" on={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></Btn>
        <Btn label="Trích dẫn" on={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></Btn>
        <Btn label="Đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></Btn>
      </Group>
      <Group>
        <Btn label={state.link ? "Sửa liên kết" : "Chèn liên kết"} on={state.link} onClick={setLink}>{state.link ? <Link2Off size={15} /> : <Link2 size={15} />}</Btn>
        <Btn label="Tải ảnh lên và chèn" onClick={() => fileRef.current?.click()}><ImagePlus size={15} /></Btn>
        <Btn label="Xóa định dạng" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser size={15} /></Btn>
      </Group>
      <Group>
        <Btn label="Hoàn tác (Ctrl+Z)" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></Btn>
        <Btn label="Làm lại (Ctrl+Y)" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></Btn>
      </Group>
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className={styles.rteGroup}>{children}</div>;
}

function Btn({ label, on, disabled, onClick, children }: { label: string; on?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      className={`${styles.rteButton} ${on ? styles.rteButtonOn : ""}`}
      // Keep the editor selection: focus must not jump to the toolbar button.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
