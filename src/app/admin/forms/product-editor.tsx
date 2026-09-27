"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Hand,
  ImageIcon,
  LoaderCircle,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { adminApi, type AdminCategory, type AdminProduct, type VariantInput } from "@/lib/api/admin";
import { formatCurrency } from "@/lib/format";
import { queueToast } from "../admin-data";
import styles from "../admin.module.css";
import { Field, numberOrUndefined, useAsyncAction } from "./modal";
import { ImageUploader } from "./image-uploader";
import { confirmDanger } from "./dialogs";
import { RichTextEditor } from "./rich-text-editor";
import { SelectMenu } from "./select-menu";

/* ----------------------------------------------------------------------------
 * Drafts & helpers
 * ------------------------------------------------------------------------- */

type VariantDraft = {
  key: string;
  id?: number;
  sku: string;
  name: string;
  accountType: string;
  duration: string;
  durationDays: string;
  price: string;
  regularPrice: string;
  costPrice: string;
  deliveryType: "auto" | "manual";
  warrantyDays: string;
  isEnabled: boolean;
  stock?: { available: number; reserved: number };
};

const newKey = () => Math.random().toString(36).slice(2);

const emptyVariant = (seed?: Partial<VariantDraft>): VariantDraft => ({
  key: newKey(),
  sku: "",
  name: "",
  accountType: "",
  duration: "",
  durationDays: "",
  price: "",
  regularPrice: "",
  costPrice: "",
  deliveryType: "manual",
  warrantyDays: "",
  isEnabled: true,
  ...seed,
});

/** Same rule as the backend (`common/utils/slug.ts`) so the preview matches what gets saved. */
function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

const digitsOnly = (value: string) => value.replace(/[^\d]/g, "");

/** "Dùng riêng · 1 tháng" when the admin leaves the package name empty. */
function variantDisplayName(draft: VariantDraft) {
  return draft.name.trim() || [draft.accountType.trim(), draft.duration.trim()].filter(Boolean).join(" · ");
}

function variantToInput(draft: VariantDraft): VariantInput {
  return {
    sku: draft.sku.trim() || undefined,
    name: variantDisplayName(draft),
    accountType: draft.accountType.trim() || undefined,
    duration: draft.duration.trim() || undefined,
    durationDays: numberOrUndefined(draft.durationDays),
    price: numberOrUndefined(draft.price) ?? 0,
    regularPrice: numberOrUndefined(draft.regularPrice),
    costPrice: numberOrUndefined(draft.costPrice),
    deliveryType: draft.deliveryType,
    warrantyDays: numberOrUndefined(draft.warrantyDays),
    isEnabled: draft.isEnabled,
  };
}

const DURATION_PRESETS = [
  { label: "1 tháng", days: 30 },
  { label: "3 tháng", days: 90 },
  { label: "6 tháng", days: 180 },
  { label: "12 tháng", days: 365 },
];

const ACCOUNT_TYPE_SUGGESTIONS = ["Dùng riêng", "Dùng chung", "Nâng cấp chính chủ", "Key bản quyền"];
const BADGE_PRESETS = ["Sale", "Hot", "Mới", "Bán chạy", "Giá tốt"];

type CategoryOption = { id: number; name: string; depth: number; path: string };

function flattenCategories(nodes: AdminCategory[], depth = 0, parentPath = ""): CategoryOption[] {
  return nodes.flatMap((node) => {
    const path = parentPath ? `${parentPath} › ${node.name}` : node.name;
    return [{ id: node.id, name: node.name, depth, path }, ...flattenCategories(node.children ?? [], depth + 1, path)];
  });
}

/* ----------------------------------------------------------------------------
 * Small controls
 * ------------------------------------------------------------------------- */

function Segmented<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  ariaLabel: string;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? styles.segmentedOn : ""}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`${styles.switch} ${checked ? styles.switchOn : ""}`} onClick={() => onChange(!checked)}>
      <i className={styles.switchKnob} />
    </button>
  );
}

function PriceField({ label, value, onChange, placeholder, hint, tone, required, ariaLabel }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  tone?: "good" | "bad" | "muted";
  required?: boolean;
  ariaLabel?: string;
}) {
  const amount = numberOrUndefined(value);
  return (
    <label className={`${styles.priceField} ${required ? styles.priceFieldRequired : ""}`}>
      <span>{label}{required ? <b> *</b> : null}</span>
      <div className={styles.priceInput}>
        <input inputMode="numeric" value={value} onChange={(event) => onChange(digitsOnly(event.target.value))} placeholder={placeholder} aria-label={ariaLabel ?? label} />
        <em>₫</em>
      </div>
      <small className={tone === "good" ? styles.priceHintGood : tone === "bad" ? styles.priceHintBad : ""}>
        {hint ?? (amount !== undefined ? formatCurrency(amount) : " ")}
      </small>
    </label>
  );
}

function BadgeChips({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const has = (badge: string) => value.some((item) => item.toLowerCase() === badge.toLowerCase());
  const toggle = (badge: string) => onChange(has(badge) ? value.filter((item) => item.toLowerCase() !== badge.toLowerCase()) : [...value, badge]);
  const commit = () => {
    const badge = draft.trim();
    if (badge && !has(badge)) onChange([...value, badge]);
    setDraft("");
  };
  const custom = value.filter((badge) => !BADGE_PRESETS.some((preset) => preset.toLowerCase() === badge.toLowerCase()));
  return (
    <div className={styles.chips}>
      {BADGE_PRESETS.map((badge) => (
        <button key={badge} type="button" className={`${styles.chip} ${has(badge) ? styles.chipOn : ""}`} aria-pressed={has(badge)} onClick={() => toggle(badge)}>{badge}</button>
      ))}
      {custom.map((badge) => (
        <span key={badge} className={`${styles.chip} ${styles.chipOn}`}>{badge}<button type="button" aria-label={`Bỏ nhãn ${badge}`} onClick={() => toggle(badge)}><X size={11} /></button></span>
      ))}
      <input
        className={styles.chipInput}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder="+ nhãn khác"
        aria-label="Thêm nhãn"
      />
    </div>
  );
}

/** Checkbox tree picker – replaces the cramped native `<select multiple>`. */
function CategoryPicker({ options, value, onChange }: { options: CategoryOption[]; value: number[]; onChange: (ids: number[]) => void }) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();
  const visible = needle ? options.filter((option) => option.path.toLowerCase().includes(needle)) : options;
  const selected = new Set(value);
  const toggle = (id: number) => onChange(selected.has(id) ? value.filter((item) => item !== id) : [...value, id]);

  // Bring the first pre-selected category into view once the tree and product have loaded.
  const hasSelection = value.length > 0 && options.length > 0;
  useEffect(() => {
    if (!hasSelection) return;
    listRef.current?.querySelector("input:checked")?.closest("label")?.scrollIntoView({ block: "nearest" });
  }, [hasSelection]);

  return (
    <div className={styles.catPicker}>
      <div className={styles.catPickerSearch}>
        <Search size={14} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Lọc danh mục…" aria-label="Lọc danh mục" />
      </div>
      <div ref={listRef} className={styles.catPickerList} role="group" aria-label="Danh mục">
        {visible.length === 0 ? <p className={styles.emptyNote}>Không có danh mục khớp.</p> : null}
        {visible.map((option) => (
          <label key={option.id} className={`${styles.catPickerRow} ${selected.has(option.id) ? styles.catPickerRowOn : ""}`} style={{ paddingLeft: 10 + (needle ? 0 : option.depth) * 16 }} title={option.path}>
            <input type="checkbox" checked={selected.has(option.id)} onChange={() => toggle(option.id)} />
            <span>{needle ? option.path : option.name}</span>
          </label>
        ))}
      </div>
      <div className={styles.catPickerMeta}>
        <span>{value.length ? `Đã chọn ${value.length} danh mục` : "Chưa chọn danh mục"}</span>
        {value.length ? <button type="button" onClick={() => onChange([])}>Bỏ chọn tất cả</button> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Variant card
 * ------------------------------------------------------------------------- */

function VariantCard({ draft, index, isEdit, canRemove, onChange, onRemove, onDuplicate }: {
  draft: VariantDraft;
  index: number;
  isEdit: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<VariantDraft>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const price = numberOrUndefined(draft.price);
  const regular = numberOrUndefined(draft.regularPrice);
  const cost = numberOrUndefined(draft.costPrice);
  const discount = price !== undefined && regular !== undefined && regular > price ? Math.round((1 - price / regular) * 100) : null;
  const regularInvalid = price !== undefined && regular !== undefined && regular < price;
  const margin = price !== undefined && cost !== undefined ? price - cost : null;

  const regularHint = regularInvalid
    ? "Phải ≥ giá bán"
    : regular !== undefined
      ? `${formatCurrency(regular)}${discount ? ` · giảm ${discount}%` : ""}`
      : "Để trống nếu không giảm giá";
  const costHint = margin !== null
    ? `Lãi ${formatCurrency(margin)}${price ? ` (${Math.round((margin / price) * 100)}%)` : ""}`
    : "Chỉ nội bộ, khách không thấy";

  return (
    <article className={`${styles.variantCard} ${draft.isEnabled ? "" : styles.variantCardOff}`}>
      <header className={styles.variantCardHead}>
        <span className={styles.variantIndex}>{index + 1}</span>
        <input
          className={styles.variantNameInput}
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={variantDisplayName({ ...draft, name: "" }) || "Tên gói · vd: Dùng riêng · 1 tháng"}
          aria-label={`Tên gói ${index + 1}`}
        />
        {isEdit && draft.deliveryType === "auto" ? (
          <span className={`${styles.stockPill} ${draft.stock && draft.stock.available > 0 ? styles.stockPillOk : ""}`}>
            {draft.id ? `${draft.stock?.available ?? 0} khả dụng` : "lưu để nhập kho"}
          </span>
        ) : null}
        <label className={styles.switchLabel}>
          <span>{draft.isEnabled ? "Đang bán" : "Tạm tắt"}</span>
          <Switch checked={draft.isEnabled} onChange={(isEnabled) => onChange({ isEnabled })} label={`Bật/tắt gói ${index + 1}`} />
        </label>
        <div className={styles.variantTools}>
          <button type="button" title="Nhân bản gói" aria-label="Nhân bản gói" onClick={onDuplicate}><Copy size={14} /></button>
          <button type="button" title={canRemove ? "Xóa gói" : "Sản phẩm cần ít nhất một gói"} aria-label="Xóa gói" onClick={onRemove} disabled={!canRemove}><Trash2 size={14} /></button>
        </div>
      </header>

      <div className={styles.variantBody}>
        <label>
          <span>Loại tài khoản</span>
          <input list="Idhub-account-types" value={draft.accountType} onChange={(event) => onChange({ accountType: event.target.value })} placeholder="Dùng riêng" />
        </label>
        <label>
          <span>Thời hạn</span>
          <div className={styles.durationInputs}>
            <input value={draft.duration} onChange={(event) => onChange({ duration: event.target.value })} placeholder="1 tháng" />
            <input inputMode="numeric" value={draft.durationDays} onChange={(event) => onChange({ durationDays: digitsOnly(event.target.value) })} placeholder="30" aria-label="Số ngày" title="Số ngày hiệu lực" />
            <em>ngày</em>
          </div>
        </label>
        <label>
          <span>SKU <i>· tự tạo nếu trống</i></span>
          <input value={draft.sku} onChange={(event) => onChange({ sku: event.target.value })} placeholder="CHATGPT-RIENG-1M" spellCheck={false} />
        </label>
      </div>

      <div className={styles.variantPrices}>
        <PriceField label="Giá bán" required value={draft.price} onChange={(price) => onChange({ price })} placeholder="99000" ariaLabel={`Giá bán gói ${index + 1}`} />
        <PriceField label="Giá gốc" value={draft.regularPrice} onChange={(regularPrice) => onChange({ regularPrice })} placeholder="199000" hint={regularHint} tone={regularInvalid ? "bad" : discount ? "good" : "muted"} ariaLabel={`Giá gốc gói ${index + 1}`} />
        <PriceField label="Giá nhập" value={draft.costPrice} onChange={(costPrice) => onChange({ costPrice })} placeholder="0" hint={costHint} tone={margin !== null ? (margin >= 0 ? "good" : "bad") : "muted"} ariaLabel={`Giá nhập gói ${index + 1}`} />
      </div>

      <footer className={styles.variantFoot}>
        <div>
          <span>Cách giao hàng</span>
          <Segmented
            ariaLabel={`Cách giao gói ${index + 1}`}
            value={draft.deliveryType}
            onChange={(deliveryType) => onChange({ deliveryType })}
            options={[
              { value: "manual", label: "Thủ công", icon: <Hand size={13} /> },
              { value: "auto", label: "Tự động", icon: <Zap size={13} /> },
            ]}
          />
        </div>
        <p>
          {draft.deliveryType === "auto"
            ? "Khách nhận tài khoản ngay sau khi thanh toán — nhập tài khoản vào kho ở cột phải sau khi lưu."
            : "Admin giao thủ công khi xử lý đơn; không cần tồn kho."}
        </p>
      </footer>
    </article>
  );
}

/* ----------------------------------------------------------------------------
 * Storefront preview
 * ------------------------------------------------------------------------- */

function PreviewCard({ name, shortDescription, image, badges, variants, status }: {
  name: string;
  shortDescription: string;
  image: string;
  badges: string[];
  variants: VariantDraft[];
  status: "draft" | "active" | "hidden";
}) {
  const priced = variants
    .filter((variant) => variant.isEnabled)
    .map((variant) => ({ price: numberOrUndefined(variant.price), regular: numberOrUndefined(variant.regularPrice) }))
    .filter((variant): variant is { price: number; regular: number | undefined } => variant.price !== undefined);
  const cheapest = priced.length ? priced.reduce((min, current) => (current.price < min.price ? current : min)) : null;
  const discount = cheapest && cheapest.regular && cheapest.regular > cheapest.price ? Math.round((1 - cheapest.price / cheapest.regular) * 100) : null;

  return (
    <div className={styles.preview}>
      <div className={styles.previewCard} aria-hidden>
        <div className={styles.previewImage}>
          {image.trim() ? <Image src={image.trim()} alt="" fill sizes="320px" className="object-cover" unoptimized /> : <ImageIcon size={30} />}
          {badges.length ? <div className={styles.previewBadges}>{badges.slice(0, 3).map((badge) => <span key={badge}>{badge}</span>)}</div> : null}
          {status !== "active" ? <span className={styles.previewStatus}>{status === "draft" ? "Nháp" : "Đang ẩn"}</span> : null}
        </div>
        <div className={styles.previewBody}>
          <strong>{name.trim() || "Tên sản phẩm"}</strong>
          <p>{shortDescription.trim() || "Mô tả ngắn sẽ hiện ở đây."}</p>
          <div className={styles.previewPrice}>
            <b>{cheapest ? formatCurrency(cheapest.price) : "—"}</b>
            {cheapest?.regular && cheapest.regular > cheapest.price ? <s>{formatCurrency(cheapest.regular)}</s> : null}
            {discount ? <i>-{discount}%</i> : null}
          </div>
          <span className={styles.previewButton}><ShoppingCart size={13} /> Chọn gói</span>
        </div>
      </div>
      <p className={styles.previewNote}>Thẻ sản phẩm trên trang chủ / danh mục, cập nhật theo những gì bạn nhập.</p>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Editor page
 * ------------------------------------------------------------------------- */

/**
 * Full-page product editor (`/admin/products/new`, `/admin/products/:id`).
 * Left: core info, variant cards (giá gốc / giá bán / giá nhập), collapsible HTML.
 * Right: live storefront preview, visibility, image, delivery/warranty, stock import, danger zone.
 */
export function ProductEditor({ productId, notify }: { productId?: number; notify: (message: string) => void }) {
  const router = useRouter();
  const isEdit = typeof productId === "number";
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [original, setOriginal] = useState<AdminProduct | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugEditing, setSlugEditing] = useState(false);
  const [status, setStatus] = useState<"draft" | "active" | "hidden">("active");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [featuredImage, setFeaturedImage] = useState("");
  const [badges, setBadges] = useState<string[]>([]);
  const [shortDescription, setShortDescription] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [contentOpen, setContentOpen] = useState(false);
  const [warrantyDays, setWarrantyDays] = useState("");
  const [deliveryTimeText, setDeliveryTimeText] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [removedVariantIds, setRemovedVariantIds] = useState<number[]>([]);

  const [stockVariantId, setStockVariantId] = useState<number | "">("");
  const [stockText, setStockText] = useState("");
  const [stockNote, setStockNote] = useState("");

  const { pending, error, setError, run } = useAsyncAction();
  const stock = useAsyncAction();
  const stockPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([adminApi.listCategories(), isEdit ? adminApi.getProduct(productId) : Promise.resolve(null)])
      .then(([tree, product]) => {
        if (!active) return;
        setCategories(flattenCategories(tree));
        if (product) {
          setOriginal(product);
          setName(product.name);
          setSlug(product.slug);
          setSlugTouched(true);
          setStatus(product.status);
          setCategoryIds(product.categories.map((category) => category.id));
          setFeaturedImage(product.featuredImage ?? "");
          setBadges(product.badges ?? []);
          setShortDescription(product.shortDescription ?? "");
          setContentHtml(product.contentHtml ?? "");
          setContentOpen(Boolean(product.contentHtml));
          setWarrantyDays(product.warrantyDays?.toString() ?? "");
          setDeliveryTimeText(product.deliveryTimeText ?? "");
          setLowStockThreshold(String(product.lowStockThreshold));
          setVariants(
            product.variants.map((variant) => ({
              key: String(variant.id),
              id: variant.id,
              sku: variant.sku,
              name: variant.name,
              accountType: variant.accountType ?? "",
              duration: variant.duration ?? "",
              durationDays: variant.durationDays?.toString() ?? "",
              price: String(variant.price),
              regularPrice: variant.regularPrice?.toString() ?? "",
              costPrice: variant.costPrice?.toString() ?? "",
              deliveryType: variant.deliveryType,
              warrantyDays: variant.warrantyDays?.toString() ?? "",
              isEnabled: variant.isEnabled,
              stock: variant.stock,
            })),
          );
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isEdit, productId, setError]);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const autoVariants = useMemo(() => variants.filter((variant) => variant.id && variant.deliveryType === "auto"), [variants]);

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((current) => current.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)));
  }

  function removeVariant(draft: VariantDraft) {
    if (draft.id) setRemovedVariantIds((current) => [...current, draft.id as number]);
    setVariants((current) => current.filter((variant) => variant.key !== draft.key));
  }

  function duplicateVariant(draft: VariantDraft) {
    setVariants((current) => {
      const index = current.findIndex((variant) => variant.key === draft.key);
      const copy = emptyVariant({ ...draft, key: newKey(), id: undefined, sku: "", stock: undefined, name: draft.name ? `${draft.name} (bản sao)` : "" });
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  /** Quick-add a package with a preset duration, inheriting type/delivery from the last one. */
  function addPreset(preset?: (typeof DURATION_PRESETS)[number]) {
    setVariants((current) => {
      const last = current[current.length - 1];
      return [
        ...current,
        emptyVariant({
          accountType: last?.accountType ?? "",
          deliveryType: last?.deliveryType ?? "manual",
          duration: preset?.label ?? "",
          durationDays: preset ? String(preset.days) : "",
        }),
      ];
    });
  }

  function validate() {
    if (name.trim().length < 2) return "Tên sản phẩm tối thiểu 2 ký tự.";
    if (!effectiveSlug) return "Đường dẫn (slug) không hợp lệ.";
    variants.forEach((variant, index) => {
      if (!variantDisplayName(variant)) throw new Error(`Gói ${index + 1}: nhập tên gói hoặc loại tài khoản / thời hạn.`);
      const price = numberOrUndefined(variant.price);
      if (price === undefined) throw new Error(`Gói ${index + 1} (${variantDisplayName(variant)}): thiếu giá bán.`);
      const regular = numberOrUndefined(variant.regularPrice);
      if (regular !== undefined && regular < price) throw new Error(`Gói ${index + 1}: giá gốc phải ≥ giá bán.`);
    });
    return null;
  }

  async function save() {
    let problem: string | null;
    try {
      problem = validate();
    } catch (caught) {
      problem = caught instanceof Error ? caught.message : "Dữ liệu chưa hợp lệ.";
    }
    if (problem) {
      setError(problem);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const base = {
      name: name.trim(),
      slug: effectiveSlug || undefined,
      status,
      categoryIds,
      featuredImage: featuredImage.trim() || undefined,
      badges: badges.map((badge) => badge.trim()).filter(Boolean),
      shortDescription: shortDescription.trim() || undefined,
      contentHtml: contentHtml.trim() || undefined,
      warrantyDays: numberOrUndefined(warrantyDays),
      deliveryTimeText: deliveryTimeText.trim() || undefined,
      lowStockThreshold: numberOrUndefined(lowStockThreshold) ?? 10,
    };

    const result = await run(async () => {
      if (!isEdit) {
        const created = await adminApi.createProduct({ ...base, variants: variants.map(variantToInput) });
        return { message: `Đã tạo sản phẩm "${created.name}" với ${variants.length} gói.`, id: created.id };
      }
      await adminApi.updateProduct(productId, base);
      for (const id of removedVariantIds) await adminApi.deleteVariant(id);
      for (const draft of variants) {
        if (draft.id) await adminApi.updateVariant(draft.id, variantToInput(draft));
        else await adminApi.addVariant(productId, variantToInput(draft));
      }
      return { message: `Đã lưu sản phẩm "${base.name}".`, id: productId };
    });
    if (!result) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // The toast must survive the navigation (the dashboard remounts on the target page).
    queueToast(result.message);
    // New products land on their edit page (stock import needs saved variants); edits go back to the list.
    router.push(isEdit ? "/admin/products" : `/admin/products/${result.id}`);
  }

  // Ctrl/Cmd + S saves from anywhere on the page.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function remove() {
    if (!isEdit || !(await confirmDanger(`Xóa sản phẩm "${original?.name ?? name}"?`, "Sản phẩm bị ẩn khỏi cửa hàng (xóa mềm); lịch sử đơn hàng vẫn được giữ."))) return;
    const ok = await run(async () => {
      await adminApi.deleteProduct(productId);
      return true;
    });
    if (ok) {
      queueToast(`Đã xóa sản phẩm "${original?.name ?? name}".`);
      router.push("/admin/products");
    }
  }

  async function importStock() {
    if (!stockVariantId) return;
    const items = stockText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!items.length) {
      stock.setError("Nhập mỗi tài khoản / key trên một dòng.");
      return;
    }
    const result = await stock.run(() => adminApi.importInventory(stockVariantId, items, stockNote.trim() || undefined));
    if (result) {
      setStockText("");
      setVariants((current) =>
        current.map((variant) =>
          variant.id === stockVariantId
            ? { ...variant, stock: { available: result.available, reserved: variant.stock?.reserved ?? 0 } }
            : variant,
        ),
      );
      notify(`Đã nhập ${result.imported} suất, còn ${result.available} khả dụng.`);
    }
  }

  const title = isEdit ? original?.name ?? "Sản phẩm" : "Thêm sản phẩm";
  const enabledCount = variants.filter((variant) => variant.isEnabled).length;

  return (
    <div className={styles.management}>
      <datalist id="Idhub-account-types">
        {ACCOUNT_TYPE_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>

      <section className={styles.editorHead}>
        <div className={styles.editorHeadText}>
          <Link href="/admin/products" className={styles.editorBack}><ArrowLeft size={14} /> Danh sách sản phẩm</Link>
          <div className={styles.editorTitle}>
            <span className={styles.titleIcon}><Package size={20} /></span>
            <div>
              <h1>{title}</h1>
              <p>{isEdit ? `SP-${productId} · ${variants.length} gói (${enabledCount} đang bán)` : "Nhập thông tin, thêm gói giá — thẻ xem trước bên phải cập nhật theo bạn."}</p>
            </div>
          </div>
        </div>
        <div className={styles.editorHeadActions}>
          {isEdit && original ? <a className={styles.secondaryButton} href={`/${original.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Xem trên cửa hàng</a> : null}
          <button type="button" className={styles.secondaryButton} onClick={() => router.push("/admin/products")}>Hủy</button>
          <button type="button" className={styles.primaryButton} disabled={pending || loading} onClick={() => void save()} title="Ctrl + S">
            {pending ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} {pending ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Tạo sản phẩm"}
          </button>
        </div>
      </section>

      {error ? <p role="alert" className={styles.inlineAlert}>{error}</p> : null}

      {loading ? (
        <div className={styles.modalLoading}><LoaderCircle size={22} className="animate-spin" /> Đang tải…</div>
      ) : (
        <div className={styles.editorGrid}>
          <div className={styles.editorMain}>
            {/* ---------------------------------------------------------------- basics */}
            <article className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>Thông tin cơ bản</h2><p>Tên, đường dẫn, nhãn và mô tả ngắn hiển thị cho khách</p></div></div>
              <div className={`${styles.formGrid} ${styles.formGridSingle}`}>
                <div className={`${styles.fullField} ${styles.fieldBlock}`}>
                  <span>Tên sản phẩm <b className={styles.required}>*</b></span>
                  <input className={styles.inputLg} value={name} onChange={(event) => setName(event.target.value)} placeholder="Tài khoản ChatGPT Plus" autoFocus={!isEdit} aria-label="Tên sản phẩm" />
                  <div className={styles.slugLine}>
                    <span className={styles.slugPrefix}>Đường dẫn:</span>
                    {slugEditing ? (
                      <>
                        <input
                          className={styles.slugInput}
                          value={slug}
                          autoFocus
                          onChange={(event) => { setSlug(event.target.value); setSlugTouched(true); }}
                          onBlur={() => { setSlug((current) => slugify(current) || slugify(name)); setSlugEditing(false); }}
                          onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }}
                          aria-label="Slug"
                        />
                        <button type="button" onClick={() => { setSlugTouched(false); setSlugEditing(false); }}>Tự tạo lại</button>
                      </>
                    ) : (
                      <>
                        <code>/{effectiveSlug || "…"}</code>
                        <button type="button" onClick={() => { setSlug(effectiveSlug); setSlugEditing(true); }} aria-label="Sửa đường dẫn"><Pencil size={12} /> Sửa</button>
                      </>
                    )}
                  </div>
                </div>
                <div className={`${styles.fullField} ${styles.fieldBlock}`}>
                  <span>Nhãn trên thẻ<em className={styles.fieldHint}> · hiện góc ảnh sản phẩm</em></span>
                  <BadgeChips value={badges} onChange={setBadges} />
                </div>
                <Field label="Mô tả ngắn" full hint="1–2 câu, hiện dưới tiêu đề và trên thẻ">
                  <textarea rows={2} value={shortDescription} onChange={(event) => setShortDescription(event.target.value.slice(0, 200))} placeholder="Tài khoản chính chủ, bảo hành trọn thời gian sử dụng…" />
                  <small className={styles.counter}>{shortDescription.length}/200</small>
                </Field>
              </div>
            </article>

            {/* ---------------------------------------------------------------- variants */}
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><h2>Gói & giá</h2><p>Mỗi gói = loại tài khoản × thời hạn. Khách thấy giá bán và giá gốc gạch ngang; giá nhập chỉ dùng nội bộ.</p></div>
                <button type="button" className={styles.secondaryButton} onClick={() => addPreset()}><Plus size={15} /> Thêm gói</button>
              </div>
              <div className={styles.variantStack}>
                {variants.map((variant, index) => (
                  <VariantCard
                    key={variant.key}
                    draft={variant}
                    index={index}
                    isEdit={isEdit}
                    canRemove={variants.length > 1}
                    onChange={(patch) => updateVariant(variant.key, patch)}
                    onRemove={() => removeVariant(variant)}
                    onDuplicate={() => duplicateVariant(variant)}
                  />
                ))}
                <div className={styles.presetRow}>
                  <span>Thêm nhanh:</span>
                  {DURATION_PRESETS.map((preset) => (
                    <button key={preset.label} type="button" onClick={() => addPreset(preset)}><Plus size={12} /> {preset.label}</button>
                  ))}
                </div>
              </div>
            </article>

            {/* ---------------------------------------------------------------- delivery & warranty */}
            <article className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>Giao hàng & bảo hành</h2><p>Hiện ở khối cam kết trên trang sản phẩm; ngưỡng kho dùng cho cảnh báo nội bộ</p></div></div>
              <div className={`${styles.formGrid} ${styles.formGridThree}`}>
                <Field label="Thời gian giao"><input value={deliveryTimeText} onChange={(event) => setDeliveryTimeText(event.target.value)} placeholder="Giao tự động 5–15 phút" /></Field>
                <Field label="Bảo hành (ngày)"><input inputMode="numeric" value={warrantyDays} onChange={(event) => setWarrantyDays(digitsOnly(event.target.value))} placeholder="30" /></Field>
                <Field label="Ngưỡng cảnh báo kho" hint="báo 'sắp hết' khi tồn dưới"><input inputMode="numeric" value={lowStockThreshold} onChange={(event) => setLowStockThreshold(digitsOnly(event.target.value))} /></Field>
              </div>
            </article>

            {/* ---------------------------------------------------------------- content */}
            <article className={styles.panel}>
              <button type="button" className={styles.collapseHead} onClick={() => setContentOpen((open) => !open)} aria-expanded={contentOpen}>
                <div><h2>Nội dung chi tiết</h2><p>Bài mô tả hiển thị trên trang sản phẩm{contentHtml.trim() ? ` · ${contentHtml.trim().length.toLocaleString("vi-VN")} ký tự` : " · chưa có"}</p></div>
                <ChevronDown size={18} className={contentOpen ? styles.collapseOpen : ""} />
              </button>
              {contentOpen ? (
                <div className={styles.collapseBody}>
                  <RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="Giới thiệu sản phẩm, quyền lợi, cách nhận hàng… (gõ / hoặc dùng thanh công cụ để định dạng)" />
                </div>
              ) : null}
            </article>
          </div>

          <aside className={styles.editorSide}>
            {/* ---------------------------------------------------------------- preview */}
            <article className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>Xem trước</h2><p>Thẻ sản phẩm ngoài cửa hàng</p></div></div>
              <PreviewCard name={name} shortDescription={shortDescription} image={featuredImage} badges={badges} variants={variants} status={status} />
            </article>

            {/* ---------------------------------------------------------------- visibility */}
            <article className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>Hiển thị</h2><p>Trạng thái và danh mục</p></div></div>
              <div className={`${styles.formGrid} ${styles.formGridSingle}`}>
                <div className={`${styles.fullField} ${styles.fieldBlock}`}>
                  <span>Trạng thái</span>
                  <Segmented
                    ariaLabel="Trạng thái sản phẩm"
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: "active", label: "Đang bán" },
                      { value: "hidden", label: "Ẩn" },
                      { value: "draft", label: "Nháp" },
                    ]}
                  />
                  <small className={styles.segHint}>
                    {status === "active" ? "Hiện trên cửa hàng và có thể mua." : status === "hidden" ? "Không hiện trên danh sách; chỉ mở được bằng link trực tiếp." : "Chưa công khai, chỉ admin thấy."}
                  </small>
                </div>
                <div className={`${styles.fullField} ${styles.fieldBlock}`}>
                  <span>Danh mục<em className={styles.fieldHint}> · chọn một hoặc nhiều</em></span>
                  <CategoryPicker options={categories} value={categoryIds} onChange={setCategoryIds} />
                </div>
              </div>
            </article>

            {/* ---------------------------------------------------------------- image */}
            <article className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>Ảnh đại diện</h2><p>Ảnh vuông, tối thiểu 600×600px</p></div></div>
              <div className={`${styles.formGrid} ${styles.formGridSingle}`}>
                <ImageUploader value={featuredImage} onChange={setFeaturedImage} label="Ảnh đại diện" />
              </div>
            </article>

            {/* ---------------------------------------------------------------- stock import (edit only) */}
            {isEdit && autoVariants.length ? (
              <article className={styles.panel} ref={stockPanelRef}>
                <div className={styles.panelHeader}><div><h2>Nhập kho</h2><p>Mỗi dòng là một tài khoản / key giao tự động</p></div></div>
                <div className={`${styles.formGrid} ${styles.formGridSingle}`}>
                  <div className={`${styles.fullField} ${styles.fieldBlock}`}>
                    <span>Gói</span>
                    <SelectMenu
                      value={stockVariantId === "" ? "" : String(stockVariantId)}
                      onChange={(value) => setStockVariantId(value ? Number(value) : "")}
                      placeholder="— chọn gói giao tự động —"
                      options={autoVariants.map((variant) => ({
                        value: String(variant.id),
                        label: `${variantDisplayName(variant)} · ${formatCurrency(Number(variant.price) || 0)}`,
                        hint: `${variant.stock?.available ?? 0} khả dụng`,
                      }))}
                    />
                  </div>
                  <Field label="Danh sách"><textarea className={styles.codeArea} rows={5} value={stockText} onChange={(event) => setStockText(event.target.value)} placeholder={"email1@mail.com|matkhau1\nemail2@mail.com|matkhau2"} spellCheck={false} /></Field>
                  <Field label="Ghi chú lô"><input value={stockNote} onChange={(event) => setStockNote(event.target.value)} placeholder="Lô nhập ngày…" /></Field>
                  <div>
                    {stock.error ? <p role="alert" className={styles.inlineAlert}>{stock.error}</p> : null}
                    <button type="button" className={styles.secondaryButton} disabled={stock.pending || !stockVariantId} onClick={() => void importStock()}><PackagePlus size={16} /> {stock.pending ? "Đang nhập…" : "Nhập kho"}</button>
                  </div>
                </div>
              </article>
            ) : isEdit ? (
              <article className={styles.panel}>
                <div className={styles.panelHeader}><div><h2>Nhập kho</h2><p>Chuyển ít nhất một gói sang “Tự động” và lưu để nhập tài khoản vào kho.</p></div></div>
              </article>
            ) : null}

            {/* ---------------------------------------------------------------- danger */}
            {isEdit ? (
              <article className={`${styles.panel} ${styles.dangerPanel}`}>
                <div className={styles.panelHeader}><div><h2>Vùng nguy hiểm</h2><p>Sản phẩm bị xóa sẽ ẩn khỏi cửa hàng; đơn cũ vẫn giữ lịch sử.</p></div></div>
                <div style={{ padding: "0 16px 16px" }}>
                  <button type="button" className={styles.dangerButton} disabled={pending} onClick={() => void remove()}><Trash2 size={16} /> Xóa sản phẩm</button>
                </div>
              </article>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
