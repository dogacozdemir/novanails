import Banknote from "lucide-react/dist/esm/icons/banknote.mjs";
import CircleHelp from "lucide-react/dist/esm/icons/circle-help.mjs";
import CreditCard from "lucide-react/dist/esm/icons/credit-card.mjs";
import Landmark from "lucide-react/dist/esm/icons/landmark.mjs";

import type { PaymentMethodSlice } from "@/lib/payment-method-summary";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  credit_card: CreditCard,
  iban: Landmark,
};

const METHOD_BAR: Record<PaymentMethod, string> = {
  cash: "bg-emerald-500/70",
  credit_card: "bg-sky-500/70",
  iban: "bg-violet-500/70",
};

function formatMoney(n: number) {
  return `${n.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`;
}

function formatPercent(part: number, total: number) {
  if (total <= 0) return "%0";
  const pct = (part / total) * 100;
  return `%${pct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
}

type Props = {
  slices: PaymentMethodSlice[];
  total: number;
  loading?: boolean;
  title?: string;
  /** Örn. "Eylül 2026" */
  subtitle?: string;
  footnote?: string;
  className?: string;
};

/** Nakit / Kredi kartı / Havale kırılımı — tutar, işlem sayısı ve pay. */
export function PaymentMethodBreakdown({
  slices,
  total,
  loading = false,
  title = "Ödeme yöntemlerine göre tahsilat",
  subtitle,
  footnote = "Gelir kayıtlarından, tahsilat tarihine göre — toplamı “Toplam ciro” ile aynıdır.",
  className,
}: Props) {
  return (
    <section
      className={cn("glass-surface-strong rounded-3xl p-6", className)}
      aria-label={title}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Toplam:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {loading ? "…" : formatMoney(total)}
          </span>
        </p>
      </div>

      <ul
        className={cn(
          "mt-5 grid gap-3",
          slices.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"
        )}
      >
        {slices.map((s) => {
          const Icon = s.method ? METHOD_ICON[s.method] : CircleHelp;
          const pct = total > 0 ? Math.min(100, (s.amount / total) * 100) : 0;
          return (
            <li
              key={s.method ?? "unknown"}
              className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-4"
            >
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="size-4 shrink-0" aria-hidden />
                {s.label}
              </p>
              <p className="mt-2 font-heading text-2xl font-semibold tabular-nums text-foreground">
                {loading ? "…" : formatMoney(s.amount)}
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                {loading
                  ? "…"
                  : `${s.count} işlem · ${formatPercent(s.amount, total)}`}
              </p>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]"
                aria-hidden
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    s.method ? METHOD_BAR[s.method] : "bg-slate-400/70"
                  )}
                  style={{ width: loading ? "0%" : `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {footnote ? (
        <p className="mt-4 text-[11px] text-muted-foreground">{footnote}</p>
      ) : null}
    </section>
  );
}
