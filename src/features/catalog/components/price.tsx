import { formatCurrency } from "@/lib/format";

type PriceProps = {
  salePrice: number;
  regularPrice?: number;
  prefix?: string;
};

export function Price({ salePrice, regularPrice, prefix = "Từ" }: PriceProps) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-bold text-muted">{prefix}</span>
        <span className="text-lg font-extrabold text-primary-strong">
          {formatCurrency(salePrice)}
        </span>
      </div>
      {regularPrice && regularPrice > salePrice ? (
        <del className="text-sm font-bold text-muted">
          {formatCurrency(regularPrice)}
        </del>
      ) : null}
    </div>
  );
}
