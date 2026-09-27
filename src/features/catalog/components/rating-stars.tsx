import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

type RatingStarsProps = {
  rating: number;
  compact?: boolean;
};

export function RatingStars({ rating, compact = false }: RatingStarsProps) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating}/5`}>
      <span className="inline-flex text-amber-400">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={compact ? 13 : 16}
            aria-hidden="true"
            className={cn(
              "fill-current",
              index + 1 <= Math.round(rating) ? "opacity-100" : "opacity-25",
            )}
          />
        ))}
      </span>
      {!compact ? (
        <span className="font-bold text-slate-700">{rating.toFixed(1)}</span>
      ) : null}
    </span>
  );
}
