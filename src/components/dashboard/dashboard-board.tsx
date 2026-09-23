"use client";

import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import ClipboardList from "lucide-react/dist/esm/icons/clipboard-list.mjs";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up.mjs";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getDailyRevenueTotal,
  getExpenseBreakdownByCategory,
  getMonthlyFinanceWithComparison,
  getStaffRevenuePie,
  getTodayWorkload,
  type ExpenseCategorySlice,
  type FinanceTotals,
  type StaffSlice,
  type TodayTaskLine,
} from "@/app/dashboard/actions";
import { MonthOverMonthHint } from "@/components/dashboard/month-over-month-hint";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassSkeleton } from "@/components/ui/glass-skeleton";
import { formatDateTRLong, istanbulDateISO, istanbulYearMonthISO } from "@/lib/time";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

const StaffRevenuePie = dynamic(
  () =>
    import("@/components/dashboard/staff-revenue-pie").then(
      (m) => m.StaffRevenuePie
    ),
  {
    ssr: false,
    loading: () => (
      <GlassSkeleton className="h-[300px] w-full rounded-2xl" aria-hidden />
    ),
  }
);

const ExpenseBreakdownDonut = dynamic(
  () =>
    import("@/components/dashboard/expense-breakdown-donut").then(
      (m) => m.ExpenseBreakdownDonut
    ),
  {
    ssr: false,
    loading: () => (
      <GlassSkeleton className="h-[220px] w-full rounded-2xl" aria-hidden />
    ),
  }
);

function formatMoney(n: number) {
  return `${n.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`;
}

const ZERO_FINANCE: FinanceTotals = {
  revenue: 0,
  expenses: 0,
  net: 0,
};

export function DashboardBoard({ sessionRole }: { sessionRole: UserRole }) {
  const isStaff = sessionRole === "staff";
  const [monthISO, setMonthISO] = useState(() => istanbulYearMonthISO());
  const [dayISO, setDayISO] = useState(() => istanbulDateISO());
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState<{
    current: FinanceTotals;
    previous: FinanceTotals;
  }>({
    current: { revenue: 0, expenses: 0, net: 0 },
    previous: { revenue: 0, expenses: 0, net: 0 },
  });
  const [expenseSlices, setExpenseSlices] = useState<ExpenseCategorySlice[]>([]);
  const [pie, setPie] = useState<StaffSlice[]>([]);
  const [today, setToday] = useState<TodayTaskLine[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isStaff) {
        const t = await getTodayWorkload();
        setFinance({ current: ZERO_FINANCE, previous: ZERO_FINANCE });
        setExpenseSlices([]);
        setPie([]);
        setToday(t);
        setDailyRevenue(0);
      } else {
        const [f, p, t, exp, daily] = await Promise.all([
          getMonthlyFinanceWithComparison(monthISO),
          getStaffRevenuePie(monthISO),
          getTodayWorkload(),
          getExpenseBreakdownByCategory(monthISO),
          getDailyRevenueTotal(dayISO),
        ]);
        setFinance(f);
        setExpenseSlices(exp);
        setPie(p);
        setToday(t);
        setDailyRevenue(daily);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri alınamadı");
    } finally {
      setLoading(false);
    }
  }, [monthISO, dayISO, isStaff]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthLabel = useMemo(
    () => formatDateTRLong(`${monthISO}-01`),
    [monthISO]
  );

  const dailyRevenueLabel = useMemo(() => {
    if (dayISO === istanbulDateISO()) {
      return "Bugünkü gelir kayıtları (İstanbul)";
    }
    return `${formatDateTRLong(dayISO)} gelir kayıtları`;
  }, [dayISO]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {isStaff ? "Uzman" : "Yönetici"}
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isStaff ? "Bugünkü iş yükü özeti" : monthLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isStaff ? (
            <>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CalendarDays className="size-4" />
                Ay
              </label>
              <input
                type="month"
                value={monthISO}
                onChange={(e) => setMonthISO(e.target.value)}
                className={cn(
                  "h-11 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl",
                  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
              />
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                Gün
              </label>
              <input
                type="date"
                value={dayISO}
                onChange={(e) => setDayISO(e.target.value)}
                className={cn(
                  "h-11 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl",
                  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
              />
              <Link
                href="/finance"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex rounded-xl"
                )}
              >
                Finans
                <ChevronRight className="size-4" />
              </Link>
            </>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!isStaff ? (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-surface-strong rounded-3xl p-6 transition-glass ring-1 ring-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Günlük Ciro
            </p>
            <input
              type="date"
              value={dayISO}
              onChange={(e) => setDayISO(e.target.value)}
              aria-label="Günlük ciro tarihi"
              className={cn(
                "h-7 min-w-0 max-w-[9.5rem] cursor-pointer rounded-full border-none bg-white/10 px-2 py-0.5 font-sans text-xs tabular-nums text-foreground backdrop-blur-sm dark:bg-black/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              )}
            />
          </div>
          <p className="mt-3 font-heading text-3xl font-semibold tabular-nums text-foreground">
            {loading ? "…" : formatMoney(dailyRevenue)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {dailyRevenueLabel}
          </p>
        </div>
        <div className="glass-surface-strong rounded-3xl p-6 transition-glass">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Toplam ciro
          </p>
          <p className="mt-3 font-heading text-3xl font-semibold tabular-nums text-foreground">
            {loading ? "…" : formatMoney(finance.current.revenue)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Gelir kayıtlarından toplanan bu ay tahsilat
          </p>
          {!loading ? (
            <MonthOverMonthHint
              current={finance.current.revenue}
              previous={finance.previous.revenue}
            />
          ) : null}
        </div>
        <div className="glass-surface-strong rounded-3xl p-6 transition-glass">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Giderler
          </p>
          <p className="mt-3 font-heading text-3xl font-semibold tabular-nums text-foreground">
            {loading ? "…" : formatMoney(finance.current.expenses)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            İşletme giderleri (aynı ay)
          </p>
          {!loading ? (
            <MonthOverMonthHint
              current={finance.current.expenses}
              previous={finance.previous.expenses}
              invertGood
            />
          ) : null}
        </div>
        <div className="glass-surface-strong rounded-3xl p-6 transition-glass ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-3.5" />
            Net kar
          </p>
          <p
            className={cn(
              "mt-3 font-heading text-3xl font-semibold tabular-nums",
              finance.current.net >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600"
            )}
          >
            {loading ? "…" : formatMoney(finance.current.net)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Ciro − Gider (otomatik)
          </p>
          {!loading ? (
            <MonthOverMonthHint
              current={finance.current.net}
              previous={finance.previous.net}
            />
          ) : null}
        </div>
      </section>
      ) : null}

      <section
        className={cn(
          "grid gap-8",
          isStaff
            ? "grid-cols-1"
            : "xl:grid-cols-[minmax(0,1fr)_minmax(0,280px)_minmax(0,0.95fr)]"
        )}
      >
        {!isStaff ? (
          <>
        <div className="glass-surface-strong rounded-3xl p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Uzman ciro dağılımı
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Bu ay tahsilatın uzmanlara göre payı (gelir kayıtları).
          </p>
          <div className="mt-6">
            <StaffRevenuePie data={pie} />
          </div>
        </div>

        <div className="glass-surface-strong rounded-3xl p-5">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Gider dağılımı
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Kategori bazında (Kira, Malzeme…)
          </p>
          <div className="mt-4">
            <ExpenseBreakdownDonut data={expenseSlices} />
          </div>
        </div>
          </>
        ) : null}

        <div className="glass-surface rounded-3xl p-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-muted-foreground" />
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Bugün yapılacak işlemler
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bekleyen ve teyitli randevular
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {today.length === 0 && !loading ? (
              <li>
                <EmptyState
                  novaAccent
                  className="rounded-2xl border border-[var(--glass-border)] bg-white/60 px-4 py-10 dark:bg-zinc-950/40"
                  title="Bugün bekleyen randevu yok"
                  description="Randevu eklemek için tahtaya gidin veya uygun bir saate dokunun."
                >
                  <Link
                    href="/appointments"
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "rounded-xl shadow-diffuse"
                    )}
                  >
                    Randevu tahtasına git
                  </Link>
                </EmptyState>
              </li>
            ) : null}
            {today.map((line) => (
              <li
                key={line.label}
                className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-3 text-sm backdrop-blur-xl"
              >
                <span className="font-medium text-foreground">{line.label}</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary">
                  {line.count}×
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
