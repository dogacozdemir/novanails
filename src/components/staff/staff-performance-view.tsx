import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import CalendarClock from "lucide-react/dist/esm/icons/calendar-clock.mjs";
import TreePalm from "lucide-react/dist/esm/icons/tree-palm.mjs";
import UserMinus from "lucide-react/dist/esm/icons/user-minus.mjs";
import Link from "next/link";

import type { StaffPerformance } from "@/app/staff/actions";
import { PaymentMethodBreakdown } from "@/components/finance/payment-method-breakdown";
import { StaffPeriodPicker } from "@/components/staff/staff-period-picker";
import {
  STAFF_PERIOD_PARAM,
  staffPeriodLabel,
  staffPeriodToParam,
  type StaffPeriod,
} from "@/lib/staff-period";
import { formatDateTRLong, normalizeDisplayTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types/database";

const STATUS_META: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  waiting: {
    label: "Teyit bekliyor",
    className: "bg-amber-400/18 text-amber-900 ring-amber-400/35 dark:text-amber-100",
  },
  message_sent: {
    label: "Mesaj gönderildi",
    className: "bg-sky-400/16 text-sky-900 ring-sky-400/35 dark:text-sky-100",
  },
  confirmed: {
    label: "Teyitlendi",
    className: "bg-emerald-400/16 text-emerald-900 ring-emerald-400/35 dark:text-emerald-100",
  },
  completed: {
    label: "Tamamlandı",
    className: "bg-slate-400/18 text-slate-800 ring-slate-400/35 dark:text-slate-100",
  },
  cancelled: {
    label: "İptal",
    className: "bg-red-400/14 text-red-900 ring-red-400/35 dark:text-red-100",
  },
};

const STATUS_ORDER: AppointmentStatus[] = [
  "completed",
  "confirmed",
  "message_sent",
  "waiting",
  "cancelled",
];

function formatMoney(n: number) {
  return `${n.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`;
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-surface-strong rounded-3xl p-6 transition-glass">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-heading text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

type Props = {
  data: StaffPerformance;
  period: StaffPeriod;
  currentMonthISO: string;
};

/** Yönetici: tek çalışanın yaptığı işler, tahsilatı ve yaklaşan programı. */
export function StaffPerformanceView({ data, period, currentMonthISO }: Props) {
  const periodLabel = staffPeriodLabel(period);
  const backHref = `/staff?${STAFF_PERIOD_PARAM}=${staffPeriodToParam(period)}`;
  const serviceTotalCount = data.services.reduce((a, s) => a + s.count, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Çalışanlar
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Çalışan
          </p>
          <h1 className="mt-1 flex items-center gap-3 font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
            <span
              className="size-3 shrink-0 rounded-full ring-2 ring-white/60 shadow-sm"
              style={{ backgroundColor: data.staff.color_code }}
              aria-hidden
            />
            <span className="truncate">{data.staff.name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel} · randevu tarihine göre
          </p>
        </div>
        <StaffPeriodPicker period={period} currentMonthISO={currentMonthISO} />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tamamlanan işlem"
          value={String(data.completedCount)}
          hint={periodLabel}
        />
        <StatCard
          label="Tahsilat"
          value={formatMoney(data.revenueTotal)}
          hint="Tamamlanan randevuların gelir kayıtları"
        />
        <StatCard
          label="İptal"
          value={String(data.statusCounts.cancelled)}
          hint={periodLabel}
        />
        <StatCard
          label="Yaklaşan randevu"
          value={`${data.upcoming.length}${data.upcomingTruncated ? "+" : ""}`}
          hint="Bugünden itibaren, dönemden bağımsız"
        />
      </section>

      <section className="glass-surface-strong overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--glass-border)] px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Hizmet bazında yapılan işler
          </h2>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3">Hizmet</th>
                <th className="px-4 py-3 text-right">Adet</th>
                <th className="px-4 py-3 text-right">Pay</th>
                <th className="px-6 py-3 text-right">Tahsilat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {data.services.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-muted-foreground"
                  >
                    Bu dönemde tamamlanan işlem yok.
                  </td>
                </tr>
              ) : (
                data.services.map((s) => (
                  <tr key={s.serviceId}>
                    <td className="px-6 py-3 font-medium text-foreground">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {s.count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {serviceTotalCount > 0
                        ? `%${Math.round((s.count / serviceTotalCount) * 100)}`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-right tabular-nums">
                      {formatMoney(s.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.services.length > 0 ? (
              <tfoot>
                <tr className="border-t border-[var(--glass-border)] font-semibold">
                  <td className="px-6 py-3">Toplam</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {data.completedCount}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="whitespace-nowrap px-6 py-3 text-right tabular-nums">
                    {formatMoney(data.revenueTotal)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <PaymentMethodBreakdown
        slices={data.paymentMethods}
        total={data.paymentMethodsTotal}
        title="Ödeme yöntemleri"
        subtitle={periodLabel}
        footnote="Bu dönemde tamamlanan randevuların gelir kayıtları (randevu tarihine göre)."
      />

      <section className="glass-surface-strong rounded-3xl p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Randevu durumları
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {STATUS_ORDER.map((st) => (
            <li
              key={st}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                STATUS_META[st].className
              )}
            >
              {STATUS_META[st].label}
              <span className="tabular-nums">{data.statusCounts[st]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass-surface-strong overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--glass-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <CalendarClock className="size-5 text-muted-foreground" aria-hidden />
            Yaklaşan randevular
          </h2>
          <p className="text-xs text-muted-foreground">
            Bugünden itibaren
            {data.upcomingTruncated ? " · ilk 100 kayıt" : ""}
          </p>
        </div>
        {data.upcoming.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Yaklaşan randevu yok.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--glass-border)]">
            {data.upcoming.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {a.customerName}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {a.serviceName}
                    </span>
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatDateTRLong(a.appointment_date)} ·{" "}
                    {normalizeDisplayTime(a.appointment_time)} ·{" "}
                    {a.planned_duration} dk
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                    STATUS_META[a.status]?.className
                  )}
                >
                  {STATUS_META[a.status]?.label ?? a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-surface-strong overflow-hidden rounded-3xl">
        <div className="border-b border-[var(--glass-border)] px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Yaklaşan izin ve tatiller
          </h2>
        </div>
        {data.upcomingTimeOff.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Kayıtlı izin veya tatil yok.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--glass-border)]">
            {data.upcomingTimeOff.map((o) => {
              const Icon = o.type === "holiday" ? TreePalm : UserMinus;
              return (
                <li key={o.id} className="flex items-start gap-3 px-6 py-3">
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {o.type === "holiday" ? "Tatil" : "İzin"} ·{" "}
                      {formatDateTRLong(o.date)}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {normalizeDisplayTime(o.start_time)} –{" "}
                      {normalizeDisplayTime(o.end_time)}
                      {o.reason?.trim() ? ` · ${o.reason.trim()}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
