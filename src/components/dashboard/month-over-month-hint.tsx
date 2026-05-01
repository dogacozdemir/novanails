"use client";

import TrendingDown from "lucide-react/dist/esm/icons/trending-down.mjs";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up.mjs";
import { cn } from "@/lib/utils";

type Props = {
  current: number;
  previous: number;
  /** Gider gibi: azalış yeşil, artış kırmızı */
  invertGood?: boolean;
  className?: string;
};

/** Önceki takvim ayına göre yüzde değişim (tamamen gerçek veri). */
export function MonthOverMonthHint({
  current,
  previous,
  invertGood = false,
  className,
}: Props) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;

  if (previous === 0 && current === 0) return null;

  if (previous === 0 && current !== 0) {
    return (
      <p
        className={cn(
          "mt-2 text-[11px] leading-snug text-muted-foreground",
          className
        )}
      >
        Geçen ay bu kaleme ait kayıt yok (ilk dönem verisi)
      </p>
    );
  }

  const pct = ((current - previous) / previous) * 100;
  const rounded =
    Math.abs(pct) < 0.05 ? 0 : Math.round(pct * 10) / 10;
  const up = pct > 0;
  const down = pct < 0;

  const positiveTone = invertGood ? down : up;
  const negativeTone = invertGood ? up : down;

  return (
    <p
      className={cn(
        "mt-2 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums leading-snug",
        rounded === 0 && "text-muted-foreground",
        rounded !== 0 && positiveTone && "text-emerald-700 dark:text-emerald-400",
        rounded !== 0 && negativeTone && "text-red-600 dark:text-red-400",
        className
      )}
    >
      {rounded !== 0 ? (
        up ? (
          <TrendingUp className="size-3 shrink-0 opacity-90" aria-hidden />
        ) : (
          <TrendingDown className="size-3 shrink-0 opacity-90" aria-hidden />
        )
      ) : null}
      <span className="text-muted-foreground">Geçen aya göre </span>
      <span className="font-semibold text-foreground">
        {rounded === 0
          ? "değişim yok"
          : `${pct > 0 ? "+" : ""}${rounded.toLocaleString("tr-TR", {
              maximumFractionDigits: 1,
            })}%`}
      </span>
    </p>
  );
}
