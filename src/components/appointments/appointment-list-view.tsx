"use client";

import Plus from "lucide-react/dist/esm/icons/plus.mjs";

import type {
  EnrichedAppointment,
  StaffBrief,
  TimelineEvent,
} from "@/app/appointments/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  calendarDisplayDurationMinutes,
  formatDateTRLong,
  normalizeDisplayTime,
} from "@/lib/time";
import type { AppointmentStatus } from "@/types/database";
import { cn } from "@/lib/utils";

function appointmentStatusBadge(status: AppointmentStatus) {
  switch (status) {
    case "waiting":
      return {
        label: "Teyit bekliyor",
        className:
          "bg-[#FBBF24]/20 text-[#78350f] ring-1 ring-[#FBBF24]/45 dark:text-amber-100",
      };
    case "message_sent":
      return {
        label: "Mesaj gönderildi",
        className:
          "bg-[#3BF]/20 text-[#1e3a8a] ring-1 ring-blue-400/50 dark:text-[#bfdbfe]",
      };
    case "confirmed":
      return {
        label: "Teyitlendi",
        className:
          "bg-emerald-500/20 text-emerald-950 ring-1 ring-emerald-400/55 dark:text-emerald-100",
      };
    case "cancelled":
      return {
        label: "İptal",
        className:
          "bg-red-500/22 text-red-950 ring-1 ring-red-400/55 dark:text-red-100",
      };
    case "completed":
      return {
        label: "Tamamlandı",
        className:
          "bg-slate-500/20 text-slate-900 ring-1 ring-slate-400/50 dark:text-slate-100",
      };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

export type AppointmentListViewProps = {
  events: TimelineEvent[];
  staffList: StaffBrief[];
  loading: boolean;
  error: string | null;
  onAppointmentPress: (row: EnrichedAppointment) => void;
  onCreateFromSlot: (p: {
    staffId: string;
    dateISO: string;
    timeHHmm: string;
  }) => void;
  /** İptal satırlarını düşük opaklıkta göster (İptalleri Göster açıkken) */
  dimCancelled?: boolean;
};

export function AppointmentListView({
  events,
  staffList,
  loading,
  error,
  onAppointmentPress,
  onCreateFromSlot,
  dimCancelled = false,
}: AppointmentListViewProps) {
  const staffMap = Object.fromEntries(staffList.map((s) => [s.id, s]));
  return (
    <div className="liquid-glass-v2 overflow-hidden rounded-[1.5rem] shadow-diffuse">
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[720px] border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] bg-[var(--glass-bg-strong)]/90 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-md dark:border-white/[0.08]">
              <th className="min-h-12 px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Saat</th>
              <th className="px-4 py-3">Uzman</th>
              <th className="px-4 py-3">Müşteri / Açıklama</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Yükleniyor…
                </td>
              </tr>
            ) : null}
            {!loading && error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                  {error}
                </td>
              </tr>
            ) : null}
            {!loading && !error && events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Kriterlere uygun kayıt yok.
                </td>
              </tr>
            ) : null}
            {!loading && !error
              ? events.map((ev) => {
                  if (ev.kind === "appointment") {
                    const meta = appointmentStatusBadge(ev.status);
                    const dur = calendarDisplayDurationMinutes({
                      status: ev.status,
                      planned_duration: ev.planned_duration,
                      actual_duration: ev.actual_duration,
                      serviceDuration: ev.service?.duration ?? null,
                    });
                    const cust = ev.customer
                      ? `${ev.customer.name} ${ev.customer.surname}`.trim()
                      : "—";
                    const svc = ev.service?.name ?? "—";
                    const st = staffMap[ev.staff_id];
                    return (
                      <tr
                        key={ev.id}
                        className={cn(
                          "cursor-pointer border-b border-black/[0.04] transition-colors hover:bg-black/[0.02] dark:border-white/[0.05] dark:hover:bg-white/[0.03]",
                          dimCancelled &&
                            ev.status === "cancelled" &&
                            "opacity-50"
                        )}
                        onClick={() => {
                          const { kind, ...rest } = ev;
                          void kind;
                          onAppointmentPress(rest);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            const { kind, ...rest } = ev;
                            void kind;
                            onAppointmentPress(rest);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <td className="min-h-14 px-4 py-3 align-middle tabular-nums text-foreground/90">
                          {formatDateTRLong(ev.appointment_date)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                          {normalizeDisplayTime(ev.appointment_time)} · {dur} dk
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="size-2 shrink-0 rounded-full ring-2 ring-white/50"
                              style={{
                                backgroundColor: st?.color_code ?? "#94a3b8",
                              }}
                              aria-hidden
                            />
                            <span className="truncate font-medium">
                              {st?.name ?? "—"}
                            </span>
                          </span>
                        </td>
                        <td className="max-w-[14rem] px-4 py-3 align-middle">
                          <p className="truncate font-medium text-foreground">
                            {cust}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {svc}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide",
                              meta.className
                            )}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <span
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                              "pointer-events-none inline-flex min-h-11 min-w-11 rounded-xl font-semibold opacity-80"
                            )}
                          >
                            Aç
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  if (ev.kind === "time_off") {
                    return (
                      <tr
                        key={ev.id}
                        className="border-b border-black/[0.04] bg-amber-500/[0.04] dark:border-white/[0.05] dark:bg-amber-400/[0.06]"
                      >
                        <td className="min-h-14 px-4 py-3 align-middle">
                          {formatDateTRLong(ev.date)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums">
                          {normalizeDisplayTime(ev.start_time)} –{" "}
                          {normalizeDisplayTime(ev.end_time)}
                        </td>
                        <td className="px-4 py-3 align-middle" colSpan={2}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="size-2 shrink-0 rounded-full ring-2 ring-white/50"
                              style={{ backgroundColor: ev.staff_color }}
                              aria-hidden
                            />
                            <span className="font-medium">{ev.staff_name}</span>
                            <span className="text-muted-foreground">
                              {ev.time_off_type === "holiday" ? "Tatil" : "İzin"}
                              {ev.reason?.trim() ? ` — ${ev.reason.trim()}` : ""}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="inline-flex rounded-full bg-amber-500/22 px-2.5 py-1 text-[11px] font-bold text-amber-950 ring-1 ring-amber-400/55 dark:text-amber-100">
                            {ev.time_off_type === "holiday" ? "Tatil" : "İzinli"}
                          </span>
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={ev.id}
                      className="border-b border-black/[0.04] transition-colors hover:bg-emerald-500/[0.04] dark:border-white/[0.05]"
                    >
                      <td className="min-h-14 px-4 py-3 align-middle">
                        {formatDateTRLong(ev.appointment_date)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                        {normalizeDisplayTime(ev.appointment_time)} ·{" "}
                        {ev.block_minutes} dk
                      </td>
                      <td className="px-4 py-3 align-middle" colSpan={2}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2 shrink-0 rounded-full ring-2 ring-white/50"
                            style={{ backgroundColor: ev.staff_color }}
                            aria-hidden
                          />
                          <span className="text-muted-foreground">
                            {ev.staff_name}
                          </span>
                          <span className="font-medium text-foreground">
                            Boş slot
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="inline-flex rounded-full bg-emerald-500/16 px-2.5 py-1 text-[11px] font-bold text-emerald-900 ring-1 ring-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-100">
                          Müsait
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <Button
                          type="button"
                          variant="default"
                          size="icon"
                          className="min-h-11 min-w-11 shrink-0 touch-manipulation rounded-xl shadow-diffuse"
                          aria-label="Bu slota randevu ekle"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateFromSlot({
                              staffId: ev.staff_id,
                              dateISO: ev.appointment_date,
                              timeHHmm: normalizeDisplayTime(
                                ev.appointment_time
                              ),
                            });
                          }}
                        >
                          <Plus className="size-5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
