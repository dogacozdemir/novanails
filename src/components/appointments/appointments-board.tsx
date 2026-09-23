"use client";

import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.mjs";
import ClipboardCheck from "lucide-react/dist/esm/icons/clipboard-check.mjs";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import Phone from "lucide-react/dist/esm/icons/phone.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import Send from "lucide-react/dist/esm/icons/send.mjs";
import Slash from "lucide-react/dist/esm/icons/slash.mjs";
import Palmtree from "lucide-react/dist/esm/icons/tree-palm.mjs";
import UserMinus from "lucide-react/dist/esm/icons/user-minus.mjs";
import dynamic from "next/dynamic";
import { m } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  type MouseEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  getBoardData,
  getEnrichedAppointmentById,
  recordPaymentAndComplete,
  searchAppointmentsAdvanced,
  updateAppointmentStatus,
  type CustomerBrief,
  type EnrichedAppointment,
  type RecordPaymentPayload,
  type ServiceBrief,
  type StaffBrief,
  type TimelineEvent,
  type TimelineFilterStatus,
} from "@/app/appointments/actions";
import {
  AppointmentFilterToolbar,
  AppointmentViewModeToggle,
  type AppointmentViewMode,
} from "@/components/appointments/appointment-filter-toolbar";
import { AppointmentListView } from "@/components/appointments/appointment-list-view";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentBoardSkeleton } from "@/components/ui/glass-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  appointmentDurationPercent,
  appointmentStartPercent,
  CALENDAR_HOUR_MARKERS,
  calendarDisplayDurationMinutes,
  formatDateTRLong,
  istanbulDateISO,
  normalizeDisplayTime,
  parseTimeToMinutesFromMidnight,
  trackPercentToRoundedTime,
} from "@/lib/time";
import { computeAvailableSlotStarts } from "@/lib/compute-available-slots";
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
const EMPTY_SLOT_BLOCK_MIN = 120;

type BoardTimeOffEvent = Extract<TimelineEvent, { kind: "time_off" }>;

function eventsToBoardAppointments(
  events: TimelineEvent[],
  dateISO: string
): EnrichedAppointment[] {
  return events
    .filter(
      (e): e is Extract<TimelineEvent, { kind: "appointment" }> =>
        e.kind === "appointment" && e.appointment_date === dateISO
    )
    .map((e) => {
      const { kind, ...rest } = e;
      void kind;
      return rest;
    });
}

function boardTimeOffsForStaffDate(
  events: TimelineEvent[],
  dateISO: string,
  staffId: string
): BoardTimeOffEvent[] {
  const rows = events.filter(
    (e): e is BoardTimeOffEvent =>
      e.kind === "time_off" && e.date === dateISO && e.staff_id === staffId
  );
  return rows.sort(
    (a, b) =>
      parseTimeToMinutesFromMidnight(a.start_time) -
      parseTimeToMinutesFromMidnight(b.start_time)
  );
}

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
          <span className="font-sans text-[10px] font-medium tabular-nums tracking-wide text-muted-foreground/45">
            {String(hour).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

function statusChip(status: AppointmentStatus) {
  const iconClass = "size-3 shrink-0 stroke-[1.5] opacity-[0.92]";
  const glassShimmer =
    "relative overflow-hidden backdrop-blur-[6px] ring-1 ring-inset ring-white/30 before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/40 before:via-transparent before:to-transparent before:opacity-50 dark:ring-white/10 dark:before:from-white/15";

  switch (status) {
    case "waiting":
      return {
        Icon: Clock,
        label: "Teyit bekliyor",
        iconClass,
        className: cn(
          glassShimmer,
          "border border-amber-400/20 bg-amber-300/18 text-amber-950 shadow-[0_0_16px_-5px_rgba(245,158,11,0.35)] dark:text-amber-50"
        ),
      };
    case "message_sent":
      return {
        Icon: Send,
        label: "Mesaj gönderildi",
        iconClass,
        className: cn(
          glassShimmer,
          "border border-sky-400/22 bg-sky-400/14 text-sky-950 shadow-[0_0_16px_-5px_rgba(56,189,248,0.35)] dark:text-sky-100"
        ),
      };
    case "confirmed":
      return {
        Icon: CheckCircle2,
        label: "Teyitlendi",
        iconClass,
        className: cn(
          glassShimmer,
          "border border-emerald-400/22 bg-emerald-400/14 text-emerald-950 shadow-[0_0_16px_-5px_rgba(52,211,153,0.35)] dark:text-emerald-50"
        ),
      };
    case "cancelled":
      return {
        Icon: Slash,
        label: "İptal",
        iconClass,
        className: cn(
          glassShimmer,
          "border border-red-400/25 bg-red-400/12 text-red-950 shadow-[0_0_14px_-5px_rgba(248,113,113,0.35)] dark:text-red-100"
        ),
      };
    case "completed":
      return {
        Icon: ClipboardCheck,
        label: "Tamamlandı",
        iconClass,
        className: cn(
          glassShimmer,
          "border border-slate-400/22 bg-slate-300/16 text-slate-900 shadow-[0_0_12px_-4px_rgba(148,163,184,0.4)] dark:text-slate-100"
        ),
      };
    default:
      return {
        Icon: Clock,
        label: status,
        iconClass,
        className: cn(
          glassShimmer,
          "border border-muted-foreground/15 bg-muted/40 text-muted-foreground"
        ),
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

  const [viewMode, setViewMode] = useState<AppointmentViewMode>("board");
  const [dateRange, setDateRange] = useState(() => {
    const d = istanbulDateISO();
    return { start: d, end: d };
  });
  const [filterStaffIds, setFilterStaffIds] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<TimelineFilterStatus[]>(
    []
  );
  const [showCancelled, setShowCancelled] = useState(false);
  const [filterTimeSlot, setFilterTimeSlot] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [isPending, startTransition] = useTransition();
  const [filterError, setFilterError] = useState<string | null>(null);
  const [fetchingFilters, setFetchingFilters] = useState(false);

  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  const [createDateISO, setCreateDateISO] = useState(() => istanbulDateISO());

  const [staff, setStaff] = useState<StaffBrief[]>([]);
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

  const boardAppointments = useMemo(
    () => eventsToBoardAppointments(timelineEvents, dateRange.start),
    [timelineEvents, dateRange.start]
  );

  const visibleStaff = useMemo(() => {
    if (filterStaffIds.length === 0) return staff;
    const pick = new Set(filterStaffIds);
    return staff.filter((s) => pick.has(s.id));
  }, [staff, filterStaffIds]);

  const filterLoading = isPending || fetchingFilters;

  const hasActiveBoardNarrowingFilters = useMemo(
    () =>
      filterStatuses.length > 0 ||
      filterStaffIds.length > 0 ||
      deferredSearch.trim().length > 0,
    [filterStatuses, filterStaffIds, deferredSearch]
  );

  const appointmentsByStaff = useMemo(() => {
    const m = new Map<string, EnrichedAppointment[]>();
    for (const a of boardAppointments) {
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
  }, [boardAppointments]);

  const applyCommittedSearch = useCallback(async () => {
    const res = await searchAppointmentsAdvanced({
      dateRange,
      staffIds: filterStaffIds,
      statuses: filterStatuses,
      query: searchQuery.trim(),
      showCancelled,
      implicitEmptySlots: viewMode === "board",
    });
    startTransition(() => {
      setTimelineEvents(res.events);
      setFilterError(res.error ?? null);
    });
    return res;
  }, [
    dateRange,
    filterStaffIds,
    filterStatuses,
    searchQuery,
    startTransition,
    showCancelled,
    viewMode,
  ]);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const res = await getBoardData(dateRange.start);
    if (res.error) setLoadError(res.error);
    setStaff(res.staff);
    setCustomers(res.customers);
    setServices(res.services);
    return res;
  }, [dateRange.start]);

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
      visibleStaff.length === 0
        ? 0
        : Math.min(prev, visibleStaff.length - 1)
    );
  }, [visibleStaff]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetchingFilters(true);
      try {
        const res = await searchAppointmentsAdvanced({
          dateRange,
          staffIds: filterStaffIds,
          statuses: filterStatuses,
          query: deferredSearch.trim(),
          showCancelled,
          implicitEmptySlots: viewMode === "board",
        });
        if (!cancelled) {
          startTransition(() => {
            setTimelineEvents(res.events);
            setFilterError(res.error ?? null);
          });
        }
      } finally {
        if (!cancelled) setFetchingFilters(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    dateRange,
    filterStaffIds,
    filterStatuses,
    deferredSearch,
    startTransition,
    showCancelled,
    viewMode,
  ]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`appointments-live-${dateRange.start}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `appointment_date=eq.${dateRange.start}`,
        },
        () => {
          if (!cancelled) void applyCommittedSearch();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [dateRange.start, applyCommittedSearch]);

  const openDetail = useCallback((appt: EnrichedAppointment) => {
    setSheetAppt(appt);
    setSheetOpen(true);
  }, []);

  const syncSheetAppointments = useCallback(
    (nextAppointments: EnrichedAppointment[]) => {
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
      const res = await applyCommittedSearch();
      syncSheetAppointments(
        eventsToBoardAppointments(res.events, dateRange.start)
      );
    } finally {
      setBusy(false);
    }
  }, [sheetAppt, applyCommittedSearch, syncSheetAppointments, dateRange.start]);

  const handlePayDetail = useCallback(
    async (payload: RecordPaymentPayload) => {
      if (!sheetAppt) return;
      setBusy(true);
      try {
        await recordPaymentAndComplete(sheetAppt.id, payload);
        const res = await applyCommittedSearch();
        syncSheetAppointments(
          eventsToBoardAppointments(res.events, dateRange.start)
        );
        setSheetOpen(false);
      } finally {
        setBusy(false);
      }
    },
    [
      sheetAppt,
      dateRange.start,
      applyCommittedSearch,
      syncSheetAppointments,
    ]
  );

  const handleCancelConfirm = useCallback(async () => {
    if (!sheetAppt) return;
    setBusy(true);
    try {
      await updateAppointmentStatus(sheetAppt.id, "cancelled");
      const res = await applyCommittedSearch();
      syncSheetAppointments(
        eventsToBoardAppointments(res.events, dateRange.start)
      );
      setSheetOpen(false);
    } finally {
      setBusy(false);
    }
  }, [
    sheetAppt,
    dateRange.start,
    applyCommittedSearch,
    syncSheetAppointments,
  ]);

  const handleWhatsAppOpen = useCallback(async () => {
    if (!sheetAppt) return;
    if (sheetAppt.status === "waiting") {
      setBusy(true);
      try {
        await updateAppointmentStatus(sheetAppt.id, "message_sent");
        const res = await applyCommittedSearch();
        syncSheetAppointments(
          eventsToBoardAppointments(res.events, dateRange.start)
        );
      } finally {
        setBusy(false);
      }
    }
  }, [
    sheetAppt,
    dateRange.start,
    applyCommittedSearch,
    syncSheetAppointments,
  ]);

  const openCreate = useCallback(
    (staffId: string, slotTime: string) => {
      setCreateDateISO(dateRange.start);
      setCreateCtx({ staffId, slotTime });
      setCreateOpen(true);
    },
    [dateRange.start]
  );

  const handleCreateFromList = useCallback(
    (p: { staffId: string; dateISO: string; timeHHmm: string }) => {
      setCreateDateISO(p.dateISO);
      setCreateCtx({ staffId: p.staffId, slotTime: p.timeHHmm });
      setCreateOpen(true);
    },
    []
  );

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

  const headerSubtitle = useMemo(() => {
    if (viewMode === "list") {
      if (dateRange.start === dateRange.end) {
        return `${formatDateTRLong(dateRange.start)} · Liste görünümü`;
      }
      return `${formatDateTRLong(dateRange.start)} – ${formatDateTRLong(dateRange.end)}`;
    }
    return formatDateTRLong(dateRange.start);
  }, [viewMode, dateRange.start, dateRange.end]);

  const handleAppointmentEdited = useCallback(async () => {
    await refresh();
    const res = await applyCommittedSearch();
    syncSheetAppointments(
      eventsToBoardAppointments(res.events, dateRange.start)
    );
  }, [
    refresh,
    applyCommittedSearch,
    syncSheetAppointments,
    dateRange.start,
  ]);

  /** Ödeme düzeltmesi: liste tazelenir, açık randevu (tarihten bağımsız) yeniden okunur. */
  const sheetApptId = sheetAppt?.id ?? null;
  const handlePaymentCorrected = useCallback(async () => {
    await applyCommittedSearch();
    if (!sheetApptId) return;
    const res = await getEnrichedAppointmentById(sheetApptId);
    if (res.appointment) setSheetAppt(res.appointment);
  }, [applyCommittedSearch, sheetApptId]);

  const handleCreateSuccess = useCallback(async () => {
    await refresh();
    await applyCommittedSearch();
  }, [refresh, applyCommittedSearch]);

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
      <m.div
        layout={false}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
        className={cn(
          "nova-glass-appointment-card liquid-glass-v2 shadow-diffuse group/card relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[1.1rem] transition-[transform,box-shadow] duration-300 will-change-[backdrop-filter,transform] hover:-translate-y-[1px] hover:shadow-diffuse dark:!shadow-[0_28px_70px_-24px_rgba(0,0,0,0.35)]",
          appt.status === "cancelled" &&
            cn(
              "border border-[#EF4444]/30 bg-[#EF4444]/[0.09]",
              showCancelled && "opacity-50"
            ),
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
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 font-sans text-[9px] font-semibold tracking-wide sm:text-[10px]",
                  chip.className
                )}
              >
                <Icon className={chip.iconClass} aria-hidden />
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
      </m.div>
    );
  }, [openDetail, showCancelled]);

  const renderTimeOffBlock = useCallback((off: BoardTimeOffEvent) => {
    const isHol = off.time_off_type === "holiday";
    const Icon = isHol ? Palmtree : UserMinus;
    const label = isHol ? "Tatil" : "İzinli";
    const startMin = parseTimeToMinutesFromMidnight(off.start_time);
    const endMin = parseTimeToMinutesFromMidnight(off.end_time);
    const blockMin = Math.max(15, endMin - startMin);
    const top = appointmentStartPercent(off.start_time);
    const hPct = appointmentDurationPercent(blockMin);
    return (
      <div
        key={off.id}
        className="pointer-events-none absolute left-0 right-0 z-[2] isolate overflow-hidden px-0"
        style={{ top: `${top}%`, height: `${hPct}%` }}
      >
        <div className="box-border flex h-full min-h-0 flex-col justify-center rounded-[1.05rem] border border-black/[0.1] bg-black/[0.06] px-2 py-1 shadow-inner ring-1 ring-black/[0.04] backdrop-blur-md dark:border-white/[0.12] dark:bg-white/[0.08] dark:ring-white/[0.06]">
          <div className="flex items-center gap-1.5 font-sans text-[9px] font-semibold tracking-wide text-muted-foreground sm:text-[10px]">
            <Icon className="size-3 shrink-0 opacity-75" aria-hidden />
            <span className="text-foreground/75">{label}</span>
            <span className="ml-auto tabular-nums font-normal opacity-80">
              {normalizeDisplayTime(off.start_time)}–
              {normalizeDisplayTime(off.end_time)}
            </span>
          </div>
        </div>
      </div>
    );
  }, []);

  const renderTimelineTrack = useCallback((
    staffMember: { id: string; name: string; color_code: string },
    variant: "mobile" | "desktop"
  ) => {
    const staffApps = appointmentsByStaff.get(staffMember.id) ?? [];
    const staffOff = boardTimeOffsForStaffDate(
      timelineEvents,
      dateRange.start,
      staffMember.id
    );
    const padX = variant === "mobile" ? "px-2" : "px-2 sm:px-2.5";

    const busyIntervals: { start: number; end: number }[] = [];
    for (const appt of staffApps) {
      if (appt.status === "cancelled") continue;
      const start = parseTimeToMinutesFromMidnight(appt.appointment_time);
      const len = calendarDisplayDurationMinutes({
        status: appt.status,
        planned_duration: appt.planned_duration,
        actual_duration: appt.actual_duration,
        serviceDuration: appt.service?.duration ?? null,
      });
      busyIntervals.push({ start, end: start + len });
    }
    for (const off of staffOff) {
      const sm = parseTimeToMinutesFromMidnight(off.start_time);
      const em = parseTimeToMinutesFromMidnight(off.end_time);
      if (em > sm) {
        busyIntervals.push({ start: sm, end: em });
      }
    }
    const availableSlots = computeAvailableSlotStarts({
      busyIntervals,
      durationMinutes: EMPTY_SLOT_BLOCK_MIN,
    });

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
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-black/[0.18] opacity-20 dark:border-white/[0.2]"
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
            {availableSlots.map((slot) => {
              const top = appointmentStartPercent(slot);
              const hPct = appointmentDurationPercent(EMPTY_SLOT_BLOCK_MIN);
              return (
                <div
                  key={`avail-${staffMember.id}-${slot}`}
                  className="pointer-events-auto absolute left-0 right-0 z-[1] isolate px-0"
                  style={{ top: `${top}%`, height: `${hPct}%` }}
                >
                  <m.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 520, damping: 32 }}
                    onClick={() => openCreate(staffMember.id, slot)}
                    className={cn(
                      "liquid-glass-v2 shadow-diffuse box-border flex h-full min-h-0 w-full touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[1.05rem] border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] transition-all hover:bg-emerald-500/[0.07] dark:border-emerald-400/25"
                    )}
                    aria-label={`${staffMember.name} — ${slot} müsait slot, randevu ekle`}
                  >
                    <Plus
                      className="size-4 shrink-0 text-emerald-600/45 dark:text-emerald-400/50"
                      aria-hidden
                    />
                    <span className="font-sans text-[9px] font-semibold uppercase tracking-wider text-emerald-800/35 dark:text-emerald-200/40">
                      Müsait
                    </span>
                  </m.button>
                </div>
              );
            })}
            {staffOff.map((off) => renderTimeOffBlock(off))}
            {staffApps.map((appt) => {
              const top = appointmentStartPercent(appt.appointment_time);
              const blockMin = calendarDisplayDurationMinutes({
                status: appt.status,
                planned_duration: appt.planned_duration,
                actual_duration: appt.actual_duration,
                serviceDuration: appt.service?.duration ?? null,
              });
              const hPct = appointmentDurationPercent(blockMin);
              const matchesTimeSlot =
                !filterTimeSlot ||
                normalizeDisplayTime(appt.appointment_time) === filterTimeSlot;
              return (
                <div
                  key={appt.id}
                  className={cn(
                    "pointer-events-auto absolute left-0 right-0 z-[3] isolate overflow-hidden px-0 transition-[opacity,transform,filter] duration-300",
                    filterTimeSlot &&
                      !matchesTimeSlot &&
                      "pointer-events-none scale-[0.98] opacity-15 blur-[0.5px]"
                  )}
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
  }, [
    appointmentsByStaff,
    dateRange.start,
    filterTimeSlot,
    handleTrackClick,
    openCreate,
    renderAppointmentCard,
    renderTimeOffBlock,
    timelineEvents,
  ]);

  if (loading && !staff.length) {
    return <AppointmentBoardSkeleton />;
  }

  const mobileStaff = visibleStaff[mobileStaffIdx];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <header className="flex w-full flex-col gap-3">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Nova Nail Studio
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)] sm:text-4xl">
              Randevu tahtası
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {headerSubtitle}
            </p>
          </div>
          <AppointmentViewModeToggle
            viewMode={viewMode}
            onViewModeChange={(m) => {
              setViewMode(m);
              if (m === "board") {
                setDateRange((r) => ({ start: r.start, end: r.start }));
              }
            }}
          />
        </div>
        <AppointmentFilterToolbar
          viewMode={viewMode}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          staffList={staff}
          selectedStaffIds={filterStaffIds}
          onSelectedStaffIdsChange={setFilterStaffIds}
          selectedStatuses={filterStatuses}
          onSelectedStatusesChange={setFilterStatuses}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filterPending={filterLoading}
          showCancelled={showCancelled}
          onShowCancelledChange={setShowCancelled}
          filterTimeSlot={filterTimeSlot}
          onFilterTimeSlotChange={setFilterTimeSlot}
        />
      </header>

      {loadError ? (
        <div className="liquid-glass-v2 rounded-2xl px-4 py-3 font-sans text-sm text-destructive shadow-diffuse">
          {loadError} Oturum veya Supabase anahtarlarını kontrol edin.
        </div>
      ) : null}

      {filterError ? (
        <div className="liquid-glass-v2 rounded-2xl px-4 py-3 font-sans text-sm text-destructive shadow-diffuse">
          {filterError}
        </div>
      ) : null}

      {staff.length > 0 &&
      filterStaffIds.length > 0 &&
      visibleStaff.length === 0 &&
      viewMode === "board" ? (
        <div className="liquid-glass-v2 rounded-[1.25rem] border border-dashed border-[#EA580C]/35 bg-[#EA580C]/[0.06] px-4 py-5 shadow-diffuse">
          <p className="font-sans text-sm font-medium text-foreground">
            Seçili uzman filtresine uyan sütun yok.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Farklı uzmanlar seçin veya uzman filtresini temizleyin.
          </p>
        </div>
      ) : null}

      {staff.length > 0 &&
      boardAppointments.length === 0 &&
      !loading &&
      viewMode === "board" &&
      visibleStaff.length > 0 &&
      !hasActiveBoardNarrowingFilters ? (
        <div className="liquid-glass-v2 rounded-[1.25rem] border border-dashed border-primary/30 bg-primary/[0.04] px-3 shadow-diffuse sm:px-5">
          <EmptyState
            novaAccent
            className="py-8 md:py-9"
            title="Bu tarihte henüz randevu yok"
            description="Takvimde boş bir saate dokunarak veya aşağıdan ekleyerek yeni randevu oluşturabilirsiniz."
          >
            <m.div whileTap={{ scale: 0.96 }} className="inline-flex">
              <Button
                type="button"
                className="min-h-[44px] rounded-xl px-6 shadow-diffuse"
                onClick={() => {
                  const s = visibleStaff[0] ?? staff[0];
                  if (s) openCreate(s.id, "10:00");
                }}
              >
                Randevu ekle
              </Button>
            </m.div>
          </EmptyState>
        </div>
      ) : null}

      {staff.length > 0 && visibleStaff.length > 0 && viewMode === "board" ? (
        <>
          <div
            className="liquid-glass-v2 flex gap-1 rounded-[1.25rem] p-1 shadow-diffuse md:hidden"
            role="tablist"
            aria-label="Uzman seçimi"
          >
            {visibleStaff.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={mobileStaffIdx === i}
                onClick={() => setMobileStaffIdx(i)}
                className={cn(
                  "min-h-[44px] flex-1 touch-manipulation truncate rounded-[1rem] px-2 py-2 text-center font-sans text-[11px] font-semibold tracking-wide transition-colors",
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
                    {visibleStaff.map((s) => (
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
                    {visibleStaff.map((s) => (
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

      {staff.length > 0 && viewMode === "list" ? (
        <AppointmentListView
          events={timelineEvents}
          staffList={staff}
          loading={filterLoading}
          error={filterError}
          onAppointmentPress={openDetail}
          onCreateFromSlot={handleCreateFromList}
          dimCancelled={showCancelled}
        />
      ) : null}

      {staff.length === 0 && !loading ? (
        <EmptyState
          novaAccent
          title="Henüz uzman eklenmedi"
          description={
            isStaffSession
              ? "Yöneticinizin hesabınızı bir uzman kaydıyla eşleştirmesi gerekir."
              : "Ayarlar → Uzmanlar sekmesinden uzman ekleyebilir veya Kurulum sekmesinden başlangıç verisini yükleyebilirsiniz."
          }
        >
          {!isStaffSession ? (
            <Link
              href="/settings?tab=staff"
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

      {staff.length > 0 ? (
        <m.button
          type="button"
          aria-label="Hızlı randevu ekle"
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          onClick={() => {
            const s = visibleStaff[0] ?? staff[0];
            if (s) openCreate(s.id, "10:00");
          }}
          className={cn(
            "liquid-glass-v2 shadow-diffuse fixed z-50 flex size-14 items-center justify-center rounded-full border border-[var(--glass-border)] text-foreground will-change-[backdrop-filter,transform] backdrop-blur-xl",
            "max-md:bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] right-4 touch-manipulation shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.55)] md:right-8",
            "ring-1 ring-white/45 dark:border-white/15 dark:ring-white/10"
          )}
        >
          <Plus className="size-6 stroke-[1.75]" aria-hidden />
        </m.button>
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
        customers={customers}
        services={services}
        staff={staff}
        onConfirm={handleConfirmDetail}
        onPayment={handlePayDetail}
        onWhatsAppOpen={handleWhatsAppOpen}
        onCancelDialogOpen={() => setCancelOpen(true)}
        restrictStaffWorkflow={isStaffSession}
        onAppointmentEdited={handleAppointmentEdited}
        onPaymentCorrected={handlePaymentCorrected}
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
        selectedDateISO={createDateISO}
        staff={staff}
        customers={customers}
        services={services}
        isStaffSession={isStaffSession}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
