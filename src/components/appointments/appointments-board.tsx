"use client";

import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.mjs";
import ClipboardCheck from "lucide-react/dist/esm/icons/clipboard-check.mjs";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import Phone from "lucide-react/dist/esm/icons/phone.mjs";
import Send from "lucide-react/dist/esm/icons/send.mjs";
import Slash from "lucide-react/dist/esm/icons/slash.mjs";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getBoardData,
  recordPaymentAndComplete,
  updateAppointmentStatus,
  type CustomerBrief,
  type EnrichedAppointment,
  type RecordPaymentPayload,
  type ServiceBrief,
  type StaffBrief,
} from "@/app/appointments/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentBoardSkeleton } from "@/components/ui/glass-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  appointmentDurationPercent,
  appointmentStartPercent,
  CALENDAR_HOUR_MARKERS,
  calendarDisplayDurationMinutes,
  formatDateTRLong,
  localDateISO,
  normalizeDisplayTime,
  parseTimeToMinutesFromMidnight,
  trackPercentToRoundedTime,
} from "@/lib/time";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import {
  buildTelHref,
  buildWhatsAppConfirmationLink,
} from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { AppointmentStatus, UserRole } from "@/types/database";

const AppointmentCreateDialog = dynamic(
  () =>
    import("@/components/appointments/appointment-create-dialog").then(
      (m) => m.AppointmentCreateDialog
    ),
  { ssr: false, loading: () => null }
);

const AppointmentDetailSheet = dynamic(
  () =>
    import("@/components/appointments/appointment-detail-sheet").then(
      (m) => m.AppointmentDetailSheet
    ),
  { ssr: false, loading: () => null }
);

const CancelAppointmentConfirm = dynamic(
  () =>
    import("@/components/appointments/appointment-detail-sheet").then(
      (m) => m.CancelAppointmentConfirm
    ),
  { ssr: false, loading: () => null }
);

const TRACK_MIN_H = "min-h-[min(72vh,44rem)]";

function HourRail({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative shrink-0 bg-[#f5f1e9]/88 backdrop-blur-xl dark:bg-background/90",
        TRACK_MIN_H,
        compact ? "w-[3rem]" : "sticky left-0 z-[5] w-[3.25rem]"
      )}
    >
      {CALENDAR_HOUR_MARKERS.map((hour) => (
        <div
          key={`rail-${hour}`}
          className="pointer-events-none absolute left-0 right-0 flex justify-end pr-2"
          style={{
            top: `${appointmentStartPercent(
              `${String(hour).padStart(2, "0")}:00`
            )}%`,
            transform: "translateY(-50%)",
          }}
        >
          <span className="font-sans text-[11px] font-semibold tabular-nums tracking-wide text-muted-foreground">
            {String(hour).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

function statusChip(status: AppointmentStatus) {
  switch (status) {
    case "waiting":
      return {
        Icon: Clock,
        label: "Teyit bekliyor",
        className:
          "bg-[#FBBF24]/16 text-[#92400e] ring-1 ring-[#FBBF24]/35",
      };
    case "message_sent":
      return {
        Icon: Send,
        label: "Mesaj gönderildi",
        className:
          "bg-[#3B82F6]/14 text-[#1e3a8a] ring-1 ring-[#3B82F6]/42 dark:text-[#bfdbfe]",
      };
    case "confirmed":
      return {
        Icon: CheckCircle2,
        label: "Teyitlendi",
        className:
          "bg-[#10B981]/14 text-[#065f46] ring-1 ring-[#10B981]/35",
      };
    case "cancelled":
      return {
        Icon: Slash,
        label: "İptal",
        className:
          "bg-[#EF4444]/12 text-[#991b1b] ring-1 ring-[#EF4444]/35",
      };
    case "completed":
      return {
        Icon: ClipboardCheck,
        label: "Tamamlandı",
        className:
          "bg-slate-400/14 text-slate-800 ring-1 ring-slate-400/35 dark:text-slate-100",
      };
    default:
      return {
        Icon: Clock,
        label: status,
        className: "bg-muted text-muted-foreground",
      };
  }
}

function NovaWatermark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-mark.svg"
      alt=""
      width={44}
      height={44}
      className={cn(
        "pointer-events-none select-none object-contain opacity-[0.07]",
        className
      )}
      aria-hidden
      loading="lazy"
    />
  );
}

export function AppointmentsBoard({
  sessionRole,
}: {
  sessionRole: UserRole;
}) {
  const isStaffSession = sessionRole === "staff";

  const [selectedDate, setSelectedDate] = useState(() => localDateISO());
  const [staff, setStaff] = useState<StaffBrief[]>([]);
  const [appointments, setAppointments] = useState<EnrichedAppointment[]>([]);
  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [services, setServices] = useState<ServiceBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobileStaffIdx, setMobileStaffIdx] = useState(0);

  const [sheetAppt, setSheetAppt] = useState<EnrichedAppointment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createCtx, setCreateCtx] = useState<{
    staffId: string;
    slotTime: string;
  } | null>(null);

  const appointmentsByStaff = useMemo(() => {
    const m = new Map<string, EnrichedAppointment[]>();
    for (const a of appointments) {
      const list = m.get(a.staff_id) ?? [];
      list.push(a);
      m.set(a.staff_id, list);
    }
    for (const list of Array.from(m.values())) {
      list.sort(
        (a, b) =>
          parseTimeToMinutesFromMidnight(a.appointment_time) -
          parseTimeToMinutesFromMidnight(b.appointment_time)
      );
    }
    return m;
  }, [appointments]);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const res = await getBoardData(selectedDate);
    if (res.error) setLoadError(res.error);
    setStaff(res.staff);
    setAppointments(res.appointments);
    setCustomers(res.customers);
    setServices(res.services);
    return res;
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    setMobileStaffIdx((prev) =>
      staff.length === 0 ? 0 : Math.min(prev, staff.length - 1)
    );
  }, [staff]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`appointments-live-${selectedDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `appointment_date=eq.${selectedDate}`,
        },
        () => {
          if (!cancelled) void refresh();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [selectedDate, refresh]);

  const openDetail = useCallback((appt: EnrichedAppointment) => {
    setSheetAppt(appt);
    setSheetOpen(true);
  }, []);

  const syncSheetAfterRefresh = useCallback(
    async (nextAppointments: EnrichedAppointment[]) => {
      setAppointments(nextAppointments);
      setSheetAppt((prev) => {
        if (!prev) return null;
        const u = nextAppointments.find((x) => x.id === prev.id);
        return u ?? null;
      });
    },
    []
  );

  const handleConfirmDetail = useCallback(async () => {
    if (!sheetAppt) return;
    setBusy(true);
    try {
      await updateAppointmentStatus(sheetAppt.id, "confirmed");
      const res = await getBoardData(selectedDate);
      await syncSheetAfterRefresh(res.appointments);
    } finally {
      setBusy(false);
    }
  }, [sheetAppt, selectedDate, syncSheetAfterRefresh]);

  const handlePayDetail = useCallback(
    async (payload: RecordPaymentPayload) => {
      if (!sheetAppt) return;
      setBusy(true);
      try {
        await recordPaymentAndComplete(sheetAppt.id, payload);
        const res = await getBoardData(selectedDate);
        await syncSheetAfterRefresh(res.appointments);
        setSheetOpen(false);
      } finally {
        setBusy(false);
      }
    },
    [sheetAppt, selectedDate, syncSheetAfterRefresh]
  );

  const handleCancelConfirm = useCallback(async () => {
    if (!sheetAppt) return;
    setBusy(true);
    try {
      await updateAppointmentStatus(sheetAppt.id, "cancelled");
      const res = await getBoardData(selectedDate);
      await syncSheetAfterRefresh(res.appointments);
      setSheetOpen(false);
    } finally {
      setBusy(false);
    }
  }, [sheetAppt, selectedDate, syncSheetAfterRefresh]);

  const handleWhatsAppOpen = useCallback(async () => {
    if (!sheetAppt) return;
    if (sheetAppt.status === "waiting") {
      setBusy(true);
      try {
        await updateAppointmentStatus(sheetAppt.id, "message_sent");
        const res = await getBoardData(selectedDate);
        await syncSheetAfterRefresh(res.appointments);
      } finally {
        setBusy(false);
      }
    }
  }, [sheetAppt, selectedDate, syncSheetAfterRefresh]);

  const openCreate = useCallback((staffId: string, slotTime: string) => {
    setCreateCtx({ staffId, slotTime });
    setCreateOpen(true);
  }, []);

  const handleTrackClick = useCallback(
    (e: MouseEvent<HTMLElement>, staffId: string) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pct = rect.height > 0 ? (y / rect.height) * 100 : 0;
      openCreate(staffId, trackPercentToRoundedTime(pct));
    },
    [openCreate]
  );

  const sheetTimeLabel = sheetAppt
    ? normalizeDisplayTime(sheetAppt.appointment_time)
    : "";

  useEffect(() => {
    if (sheetOpen && !sheetAppt) setSheetOpen(false);
  }, [sheetOpen, sheetAppt]);

  const headerSubtitle = useMemo(
    () => formatDateTRLong(selectedDate),
    [selectedDate]
  );

  const handleAppointmentEdited = useCallback(async () => {
    const res = await getBoardData(selectedDate);
    await syncSheetAfterRefresh(res.appointments);
  }, [selectedDate, syncSheetAfterRefresh]);

  const renderAppointmentCard = useCallback((appt: EnrichedAppointment) => {
    const chip = statusChip(appt.status);
    const Icon = chip.Icon;
    const durMin = calendarDisplayDurationMinutes({
      status: appt.status,
      planned_duration: appt.planned_duration,
      actual_duration: appt.actual_duration,
      serviceDuration: appt.service?.duration ?? null,
    });
    const telHref = buildTelHref(appt.customer?.phone);
    const waHref = buildWhatsAppConfirmationLink(
      appt.customer?.phone,
      appt.customer?.name ?? "Misafir",
      formatDateTRLong(appt.appointment_date),
      normalizeDisplayTime(appt.appointment_time)
    );
    const showContactRow = Boolean(telHref || waHref);

    return (
      <div
        className={cn(
          "liquid-glass-v2 shadow-diffuse group/card relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[1.1rem] transition-[transform,box-shadow] duration-300 hover:-translate-y-[1px] hover:shadow-diffuse dark:!shadow-[0_28px_70px_-24px_rgba(0,0,0,0.35)]",
          appt.status === "cancelled" &&
            "border border-[#EF4444]/30 bg-[#EF4444]/[0.09] opacity-[0.92]",
          appt.status === "message_sent" &&
            "border border-blue-400/45 bg-blue-500/[0.12]",
          appt.status === "confirmed" &&
            "border border-emerald-400/45 bg-emerald-500/[0.13]"
        )}
      >
        <button
          type="button"
          className={cn(
            "relative z-[2] flex h-full min-h-0 touch-manipulation flex-col overflow-hidden px-3 pt-2 text-left",
            showContactRow ? "pb-8" : "pb-2"
          )}
          onClick={() => openDetail(appt)}
        >
          <NovaWatermark className="pointer-events-none absolute right-2 top-2 size-9 sm:size-10" />
          {appt.status === "cancelled" ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-3 top-1/2 z-[1] h-px -translate-y-1/2 bg-[#EF4444]/55"
            />
          ) : null}
          <div className="relative z-[2] flex min-h-0 flex-1 flex-col gap-1 pr-7">
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <p
                className={cn(
                  "line-clamp-2 min-w-0 max-w-[calc(100%-4rem)] font-sans text-[11px] leading-snug tracking-tight sm:text-[12px]",
                  appt.status === "cancelled" &&
                    "text-foreground/85 line-through decoration-[#EF4444]/90 decoration-[1.5px]"
                )}
              >
                <span className="font-bold text-foreground">
                  {appt.customer
                    ? `${appt.customer.name} ${appt.customer.surname}`
                    : "—"}
                </span>
                <span className="font-normal text-muted-foreground">
                  {" "}
                  -{" "}
                  {appt.service?.name ?? "—"}
                </span>
              </p>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 font-sans text-[9px] font-semibold tracking-wide sm:text-[10px]",
                  chip.className
                )}
              >
                <Icon className="size-2.5" aria-hidden />
                {chip.label}
              </span>
            </div>
            {appt.notes?.trim() ? (
              <p className="line-clamp-2 rounded-lg border border-[var(--glass-border)] bg-black/[0.04] px-2 py-1 text-[10px] leading-snug text-foreground dark:bg-white/[0.06]">
                {appt.notes.trim()}
              </p>
            ) : null}
            <p className="mt-auto font-mono text-[10px] tabular-nums text-muted-foreground/90">
              {normalizeDisplayTime(appt.appointment_time)} · {durMin} dk
            </p>
          </div>
        </button>
        {showContactRow ? (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[6] flex items-center justify-end gap-0.5 border-t border-black/[0.06] bg-[var(--glass-bg-strong)]/92 px-1 py-0.5 backdrop-blur-md dark:border-white/[0.08] dark:bg-[var(--glass-bg-strong)]/88">
            {telHref ? (
              <a
                href={telHref}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "pointer-events-auto size-7 rounded-md text-primary hover:bg-primary/10"
                )}
                aria-label="Telefonla ara"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="size-3.5" />
              </a>
            ) : null}
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "pointer-events-auto size-7 rounded-md text-emerald-600 hover:bg-emerald-500/10"
                )}
                aria-label="WhatsApp"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="size-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }, [openDetail]);

  const renderTimelineTrack = useCallback((
    staffMember: { id: string; name: string; color_code: string },
    variant: "mobile" | "desktop"
  ) => {
    const staffApps = appointmentsByStaff.get(staffMember.id) ?? [];
    const padX = variant === "mobile" ? "px-2" : "px-2 sm:px-2.5";

    return (
      <div
        className={cn(
          "relative flex-1 overflow-hidden border-black/[0.06] dark:border-white/[0.08]",
          variant === "desktop" && "min-w-[11.5rem] border-l border-black/[0.06] dark:border-white/[0.08]",
          variant === "mobile" && "border-l-0"
        )}
      >
        <div
          className={cn(
            "relative isolate w-full border-black/[0.05] dark:border-white/[0.06]",
            TRACK_MIN_H,
            padX
          )}
        >
          {CALENDAR_HOUR_MARKERS.map((hour) => (
            <div
              key={`${staffMember.id}-h-${hour}`}
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 border-t border-black/[0.055] dark:border-white/[0.07]"
              style={{
                top: `${appointmentStartPercent(
                  `${String(hour).padStart(2, "0")}:00`
                )}%`,
              }}
            />
          ))}

          <button
            type="button"
            className="absolute inset-0 z-0 cursor-crosshair touch-manipulation rounded-[1rem] bg-transparent outline-none ring-1 ring-transparent transition-[background-color,box-shadow] hover:bg-black/[0.015] dark:hover:bg-white/[0.03]"
            aria-label={`${staffMember.name} için saat seçerek randevu ekle`}
            onClick={(e) => handleTrackClick(e, staffMember.id)}
          />

          <div className="pointer-events-none absolute inset-0 z-[1] px-0 pb-1 pt-0">
            {staffApps.map((appt) => {
              const top = appointmentStartPercent(appt.appointment_time);
              const blockMin = calendarDisplayDurationMinutes({
                status: appt.status,
                planned_duration: appt.planned_duration,
                actual_duration: appt.actual_duration,
                serviceDuration: appt.service?.duration ?? null,
              });
              const hPct = appointmentDurationPercent(blockMin);
              return (
                <div
                  key={appt.id}
                  className="pointer-events-auto absolute left-0 right-0 z-[2] isolate overflow-hidden px-0"
                  style={{
                    top: `${top}%`,
                    height: `${hPct}%`,
                  }}
                >
                  <div className="box-border h-full min-h-0 py-0.5">
                    {renderAppointmentCard(appt)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [appointmentsByStaff, handleTrackClick, renderAppointmentCard]);

  if (loading && !staff.length) {
    return <AppointmentBoardSkeleton />;
  }

  const mobileStaff = staff[mobileStaffIdx];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <header className="glass-nav flex flex-col gap-4 rounded-[1.35rem] px-5 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Nova Nail Studio
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)] sm:text-4xl">
            Randevu tahtası
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{headerSubtitle}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <label className="text-xs font-medium text-muted-foreground">
            Tarih
          </label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="glass-surface h-11 w-full max-w-[14rem] rounded-2xl border-transparent font-sans"
          />
        </div>
      </header>

      {loadError ? (
        <div className="liquid-glass-v2 rounded-2xl px-4 py-3 font-sans text-sm text-destructive shadow-diffuse">
          {loadError} Oturum veya Supabase anahtarlarını kontrol edin.
        </div>
      ) : null}

      {staff.length > 0 && appointments.length === 0 && !loading ? (
        <div className="liquid-glass-v2 rounded-[1.25rem] border border-dashed border-primary/30 bg-primary/[0.04] px-3 shadow-diffuse sm:px-5">
          <EmptyState
            novaAccent
            className="py-8 md:py-9"
            title="Bu tarihte henüz randevu yok"
            description="Takvimde boş bir saate dokunarak veya aşağıdan ekleyerek yeni randevu oluşturabilirsiniz."
          >
            <Button
              type="button"
              className="rounded-xl shadow-diffuse"
              onClick={() =>
                staff[0] ? openCreate(staff[0].id, "10:00") : undefined
              }
            >
              Randevu ekle
            </Button>
          </EmptyState>
        </div>
      ) : null}

      {staff.length > 0 ? (
        <>
          <div
            className="liquid-glass-v2 flex gap-1 rounded-[1.25rem] p-1 shadow-diffuse md:hidden"
            role="tablist"
            aria-label="Uzman seçimi"
          >
            {staff.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={mobileStaffIdx === i}
                onClick={() => setMobileStaffIdx(i)}
                className={cn(
                  "min-h-[2.75rem] flex-1 touch-manipulation truncate rounded-[1rem] px-2 py-2 text-center font-sans text-[11px] font-semibold tracking-wide transition-colors",
                  mobileStaffIdx === i
                    ? "bg-white/55 text-foreground shadow-diffuse ring-1 ring-white/55 dark:bg-white/[0.14] dark:ring-white/20"
                    : "text-muted-foreground hover:text-foreground/90"
                )}
              >
                <span
                  className="mr-1 inline-block size-1.5 rounded-full align-middle ring-1 ring-white/50"
                  style={{ backgroundColor: s.color_code }}
                  aria-hidden
                />
                {s.name}
              </button>
            ))}
          </div>

              <div className="liquid-glass-v2 overflow-hidden rounded-[1.75rem] shadow-diffuse md:hidden overscroll-y-contain">
            <div className="border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full ring-2 ring-white/60"
                  style={{
                    backgroundColor: mobileStaff?.color_code ?? "#ccc",
                  }}
                  aria-hidden
                />
                <p className="truncate font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {mobileStaff?.name ?? ""}
                </p>
              </div>
            </div>
            <div className="flex">
              <HourRail compact />
              {mobileStaff ? renderTimelineTrack(mobileStaff, "mobile") : null}
            </div>
          </div>

          <div className="hidden md:block">
            <div className="liquid-glass-v2 overflow-hidden rounded-[1.75rem] shadow-diffuse">
              <div className="snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/[0.12] dark:[&::-webkit-scrollbar-thumb]:bg-white/15">
                <div className="min-w-[720px]">
                  <div className="flex border-b border-black/[0.06] dark:border-white/[0.08]">
                    <div className="sticky left-0 z-[6] w-[3.25rem] shrink-0 bg-[#f5f1e9]/92 backdrop-blur-xl dark:bg-background/92" />
                    {staff.map((s) => (
                      <div
                        key={s.id}
                        className="min-w-[11.5rem] flex-1 snap-start px-3 py-3 text-center"
                      >
                        <span
                          className="mx-auto mb-2 flex size-2 rounded-full ring-2 ring-white/55 shadow-sm dark:ring-white/15"
                          style={{ backgroundColor: s.color_code }}
                          aria-hidden
                        />
                        <p className="truncate font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {s.name}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex border-t border-black/[0.04] dark:border-white/[0.06]">
                    <HourRail />
                    {staff.map((s) => (
                      <Fragment key={s.id}>
                        {renderTimelineTrack(s, "desktop")}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {staff.length === 0 && !loading ? (
        <EmptyState
          novaAccent
          title="Henüz uzman eklenmedi"
          description={
            isStaffSession
              ? "Yöneticinizin hesabınızı bir uzman kaydıyla eşleştirmesi gerekir."
              : "Salon verisi için Ayarlar’dan başlangıç yükleme yapabilir veya Hizmetler’den uzman ekleyebilirsiniz."
          }
        >
          {!isStaffSession ? (
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-11 rounded-xl px-6 shadow-diffuse"
              )}
            >
              Ayarlara git
            </Link>
          ) : null}
        </EmptyState>
      ) : null}

      <AppointmentDetailSheet
        appointment={sheetAppt}
        open={sheetOpen}
        onOpenChange={(next) => {
          setSheetOpen(next);
          if (!next) queueMicrotask(() => setSheetAppt(null));
        }}
        timeLabel={sheetTimeLabel}
        busy={busy}
        sessionRole={sessionRole}
        onConfirm={handleConfirmDetail}
        onPayment={handlePayDetail}
        onWhatsAppOpen={handleWhatsAppOpen}
        onCancelDialogOpen={() => setCancelOpen(true)}
        restrictStaffWorkflow={isStaffSession}
        onAppointmentEdited={handleAppointmentEdited}
      />

      <CancelAppointmentConfirm
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        busy={busy}
        onConfirm={handleCancelConfirm}
      />

      <AppointmentCreateDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setCreateCtx(null);
        }}
        ctx={createCtx}
        selectedDateISO={selectedDate}
        staff={staff}
        customers={customers}
        services={services}
        isStaffSession={isStaffSession}
        onSuccess={async () => {
          await refresh();
        }}
      />
    </div>
  );
}
