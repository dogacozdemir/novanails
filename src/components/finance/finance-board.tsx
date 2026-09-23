"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up.mjs";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getDailyRevenueTotal,
  getMonthlyFinanceWithComparison,
  type FinanceTotals,
} from "@/app/dashboard/actions";
import { listExpenses, type ExpenseRow } from "@/app/finance/actions";
import { MonthOverMonthHint } from "@/components/dashboard/month-over-month-hint";

const ExpenseAddDialog = dynamic(
  () =>
    import("@/components/finance/expense-add-dialog").then(
      (m) => m.ExpenseAddDialog
    ),
  { ssr: false, loading: () => null }
);

const MonthlyExportButton = dynamic(
  () =>
    import("@/components/finance/monthly-export-button").then(
      (m) => m.MonthlyExportButton
    ),
  { ssr: false, loading: () => null }
);
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTRLong, istanbulDateISO, istanbulYearMonthISO } from "@/lib/time";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return `${n.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`;
}

export function FinanceBoard() {
  const [monthISO, setMonthISO] = useState(() => istanbulYearMonthISO());
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [totals, setTotals] = useState<{
    current: FinanceTotals;
    previous: FinanceTotals;
  } | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayIso = istanbulDateISO();
      const [data, snap, daily] = await Promise.all([
        listExpenses(monthISO),
        getMonthlyFinanceWithComparison(monthISO),
        getDailyRevenueTotal(todayIso),
      ]);
      setRows(data);
      setTotals(snap);
      setDailyRevenue(daily);
    } catch (e) {
      setTotals(null);
      setDailyRevenue(0);
      setError(e instanceof Error ? e.message : "Liste alınamadı");
    } finally {
      setLoading(false);
    }
  }, [monthISO]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalExpenses = useMemo(
    () => rows.reduce((a, r) => a + r.amount, 0),
    [rows]
  );
  const monthTitle = formatDateTRLong(`${monthISO}-01`);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-20 lg:px-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Raporlar
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
            Finans
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{monthTitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Button
            type="button"
            className="rounded-xl shadow-glass-inner"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            Gider ekle
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-surface-strong rounded-3xl p-6 transition-glass ring-1 ring-white/10 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Günlük Ciro
          </p>
          <p className="mt-3 font-heading text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
            {loading ? "…" : formatMoney(dailyRevenue)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Bugünkü gelir kayıtları (İstanbul)
          </p>
        </div>
        <div className="glass-surface-strong rounded-3xl p-6 transition-glass">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Toplam ciro
          </p>
          <p className="mt-3 font-heading text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
            {loading || !totals ? "…" : formatMoney(totals.current.revenue)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Gelir kayıtları — seçilen ay
          </p>
          {!loading && totals ? (
            <MonthOverMonthHint
              current={totals.current.revenue}
              previous={totals.previous.revenue}
            />
          ) : null}
        </div>
        <div className="glass-surface-strong rounded-3xl p-6 transition-glass">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Giderler (liste)
          </p>
          <p className="mt-3 font-heading text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
            {loading ? "…" : formatMoney(totalExpenses)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Bu tablodaki gider satırlarının toplamı
          </p>
          {!loading && totals ? (
            <MonthOverMonthHint
              current={totals.current.expenses}
              previous={totals.previous.expenses}
              invertGood
            />
          ) : null}
        </div>
        <div className="glass-surface-strong rounded-3xl p-6 ring-1 ring-black/[0.06] transition-glass dark:ring-white/[0.08]">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-3.5" />
            Net kar
          </p>
          <p
            className={cn(
              "mt-3 font-heading text-2xl font-semibold tabular-nums sm:text-3xl",
              totals == null && "text-foreground",
              totals != null && totals.current.net >= 0 && "text-emerald-700 dark:text-emerald-400",
              totals != null && totals.current.net < 0 && "text-red-600 dark:text-red-400"
            )}
          >
            {loading || !totals ? "…" : formatMoney(totals.current.net)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Ciro − gider (dashboard ile aynı kaynak)
          </p>
          {!loading && totals ? (
            <MonthOverMonthHint
              current={totals.current.net}
              previous={totals.previous.net}
            />
          ) : null}
        </div>
      </section>

      <section className="glass-surface-strong overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--glass-border)] px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Giderler
          </h2>
          <p className="text-sm text-muted-foreground">
            Ay toplamı:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {loading ? "…" : formatMoney(totalExpenses)}
            </span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Tutar</th>
                <th className="px-4 py-3">Açıklama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState
                      novaAccent
                      className="py-10 md:py-12"
                      title="Bu ay için henüz gider yok"
                      description="İlk kaydı ekleyerek finans takibini başlatın — üstteki «Gider ekle» veya buradan."
                    >
                      <Button
                        type="button"
                        className="rounded-xl shadow-glass-inner"
                        onClick={() => setModalOpen(true)}
                      >
                        <Plus className="mr-2 size-4" />
                        İlk gideri ekle
                      </Button>
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDateTRLong(r.expense_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {r.category_label}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                      {formatMoney(r.amount)}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-muted-foreground">
                      {r.description ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-surface rounded-3xl px-6 py-8">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Excel çıktısı
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Bu ayın gelir satırları, gider tablosu ve özet rakamları tek bir{" "}
          <span className="font-medium text-foreground">.xlsx</span> dosyasında
          indirilir (Finans ve Dashboard ile uyumlu veri).
        </p>
        <div className="mt-6">
          <MonthlyExportButton monthISO={monthISO} />
        </div>
      </section>

      <ExpenseAddDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={() => void load()}
      />
    </div>
  );
}
