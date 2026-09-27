import type { Product } from "@/types/commerce";
import { formatCurrency } from "@/lib/format";

type VariantSummaryProps = {
  product: Product;
};

export function VariantSummary({ product }: VariantSummaryProps) {
  const accounts = Array.from(
    new Set(product.variants.map((variant) => variant.attributes.accountType)),
  );
  const durations = Array.from(
    new Set(product.variants.map((variant) => variant.attributes.duration)),
  );

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <VariantGroup label="Loại gói" values={accounts} />
      <VariantGroup label="Thời hạn" values={durations} />
      <div className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        <span className="font-extrabold text-slate-950">Bảng giá mẫu: </span>
        {product.variants
          .slice(0, 4)
          .map(
            (variant) =>
              `${variant.attributes.accountType} ${variant.attributes.duration}: ${formatCurrency(
                variant.salePrice,
              )}`,
          )
          .join(" · ")}
      </div>
    </div>
  );
}

type VariantGroupProps = {
  label: string;
  values: string[];
};

function VariantGroup({ label, values }: VariantGroupProps) {
  return (
    <div>
      <div className="mb-2 text-sm font-extrabold text-slate-950">{label}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((value, index) => (
          <button
            key={value}
            className={
              index === 0
                ? "focus-ring rounded-md border border-primary bg-emerald-50 px-3 py-2 text-sm font-extrabold text-primary-strong"
                : "focus-ring rounded-md border border-border bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary-strong"
            }
            type="button"
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
