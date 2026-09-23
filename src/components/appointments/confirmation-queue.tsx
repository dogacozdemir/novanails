"use client";

import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import Phone from "lucide-react/dist/esm/icons/phone.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getBoardData,
  listPendingConfirmations,
  recordPaymentAndComplete,
  updateAppointmentStatus,
  type CustomerBrief,
  type EnrichedAppointment,
  type RecordPaymentPayload,
  type ServiceBrief,
  type StaffBrief,
} from "@/app/appointments/actions";
import {
  AppointmentDetailSheet,
  CancelAppointmentConfirm,
} from "@/components/appointments/appointment-detail-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTRLong, istanbulDateISO, normalizeDisplayTime } from "@/lib/time";
import {
  buildTelHref,
  buildWhatsAppConfirmationLink,
} from "@/lib/whatsapp";
import type { AppointmentStatus, UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

function matchesConfirmationSearch(
  appt: EnrichedAppointment,
  staffName: string,
  q: string
): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const c = appt.customer;
  const nameHaystack = c
    ? `${c.name} ${c.surname}`.toLowerCase()
    : "";
  const phoneDigits = (c?.phone ?? "").replace(/\D/g, "");
  const qDigits = q.replace(/\D/g, "");
  if (nameHaystack.includes(t)) return true;
  if (staffName.toLowerCase().includes(t)) return true;
  if (qDigits.length >= 3 && phoneDigits.includes(qDigits)) return true;
  return false;
}

function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case "waiting":
      return "Teyit bekliyor";
    case "message_sent":
      return "Mesaj gönderildi";
    default:
      return status;
  }
}

type Props = {
  sessionRole: UserRole;
};

export function ConfirmationQueue({ sessionRole }: Props) {
  const isStaffSession = sessionRole === "staff";
  const [items, setItems] = useState<EnrichedAppointment[]>([]);
  const [staffList, setStaffList] = useState<StaffBrief[]>([]);
  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [services, setServices] = useState<ServiceBrief[]>([]);
  const [boardStaff, setBoardStaff] = useState<StaffBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [sheetAppt, setSheetAppt] = useState<EnrichedAppointment | null>(
    null
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const staffById = useMemo(
    () => Object.fromEntries(staffList.map((s) => [s.id, s])),
    [staffList]
  );

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await listPendingConfirmations();
    if (res.error) setLoadError(res.error);
    setItems(res.appointments);
    setStaffList(res.staffList);

    const board = await getBoardData(istanbulDateISO());
    if (!board.error) {
      setCustomers(board.customers);
      setServices(board.services);
      setBoardStaff(board.staff);
    }

    return res;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      const sn = staffById[a.staff_id]?.name ?? "";
      return matchesConfirmationSearch(a, sn, search);
    });
  }, [items, search, staffById]);

  const syncSheetAfterList = useCallback(
    (next: EnrichedAppointment[]) => {
      setItems(next);
      setSheetAppt((prev) => {
        if (!prev) return null;
        const u = next.find((x) => x.id === prev.id);
        return u ?? null;
      });
    },
    []
  );

  const refreshAndSync = useCallback(async () => {
    const res = await listPendingConfirmations();
    if (res.error) setLoadError(res.error);
    syncSheetAfterList(res.appointments);
    setStaffList(res.staffList);
    const board = await getBoardData(istanbulDateISO());
    if (!board.error) {
      setCustomers(board.customers);
      setServices(board.services);
      setBoardStaff(board.staff);
    }
  }, [syncSheetAfterList]);

  const handleConfirmDetail = async () => {
    if (!sheetAppt) return;
    setBusy(true);
    try {
      await updateAppointmentStatus(sheetAppt.id, "confirmed");
      await refreshAndSync();
    } finally {
      setBusy(false);
    }
  };

  const handlePayDetail = async (payload: RecordPaymentPayload) => {
    if (!sheetAppt) return;
    setBusy(true);
    try {
      await recordPaymentAndComplete(sheetAppt.id, payload);
      await refreshAndSync();
      setSheetOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!sheetAppt) return;
    setBusy(true);
    try {
      await updateAppointmentStatus(sheetAppt.id, "cancelled");
      await refreshAndSync();
      setSheetOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleWhatsAppOpen = async () => {
    if (!sheetAppt) return;
    if (sheetAppt.status === "waiting") {
      setBusy(true);
      try {
        await updateAppointmentStatus(sheetAppt.id, "message_sent");
        await refreshAndSync();
      } finally {
        setBusy(false);
      }
    }
  };

  const sheetTimeLabel = sheetAppt
    ? normalizeDisplayTime(sheetAppt.appointment_time)
    : "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <header className="glass-nav rounded-[1.35rem] px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Nova Nail Studio
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
          Randevu teyit
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bugünden itibaren teyit bekleyen ve mesaj gönderilmiş randevular.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Takvim:{" "}
          <Link
            href="/appointments"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Randevu tahtası
          </Link>
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Müşteri adı veya telefon ile ara…"
          className="glass-surface h-12 rounded-2xl border-transparent pl-10 pr-4 font-sans"
          aria-label="Teyit listesinde ara"
        />
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          novaAccent
          title={items.length === 0 ? "Teyit bekleyen randevu yok" : "Eşleşme yok"}
          description={
            items.length === 0
              ? "Yeni randevular takvimden eklenir; teyit bekleyen kayıt görünür."
              : "Aramayı veya filtreleri değiştirin."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((appt) => {
            const customerLabel = appt.customer
              ? `${appt.customer.name} ${appt.customer.surname}`
              : "—";
            const telHref = buildTelHref(appt.customer?.phone);
            const firstName = appt.customer?.name ?? "Misafir";
            const wa = buildWhatsAppConfirmationLink(
              appt.customer?.phone,
              firstName,
              formatDateTRLong(appt.appointment_date),
              normalizeDisplayTime(appt.appointment_time)
            );
            const staffName = staffById[appt.staff_id]?.name ?? "—";

            return (
              <li key={appt.id}>
                <div
                  className={cn(
                    "liquid-glass-v2 overflow-hidden rounded-[1.25rem] shadow-diffuse",
                    appt.status === "message_sent" &&
                      "border border-blue-400/35 bg-blue-500/[0.06]"
                  )}
                >
                  <button
                    type="button"
                    className="w-full px-4 pb-3 pt-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    onClick={() => {
                      setSheetAppt(appt);
                      setSheetOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">
                          {customerLabel}
                        </p>
                        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                          {appt.customer?.phone ?? "Telefon yok"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#FBBF24]/18 px-2 py-0.5 text-[10px] font-semibold text-[#92400e] ring-1 ring-[#FBBF24]/35">
                        {statusLabel(appt.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatDateTRLong(appt.appointment_date)} ·{" "}
                      {normalizeDisplayTime(appt.appointment_time)} · {staffName}{" "}
                      · {appt.service?.name ?? "—"}
                    </p>
                    {appt.notes?.trim() ? (
                      <p className="mt-2 line-clamp-2 border-l-2 border-primary/35 pl-2 text-xs leading-relaxed text-foreground/90">
                        {appt.notes.trim()}
                      </p>
                    ) : null}
                  </button>

                  {(telHref || wa) ? (
                    <div className="flex items-center justify-end gap-2 border-t border-black/[0.06] px-3 py-2.5 dark:border-white/[0.08]">
                      {telHref ? (
                        <a
                          href={telHref}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "inline-flex gap-1.5 rounded-xl"
                          )}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Telefonla ara"
                        >
                          <Phone className="size-4 text-primary" aria-hidden />
                          Telefon
                        </a>
                      ) : null}
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "inline-flex gap-1.5 rounded-xl"
                          )}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="WhatsApp"
                        >
                          <MessageCircle
                            className="size-4 text-emerald-600"
                            aria-hidden
                          />
                          WhatsApp
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
        staff={boardStaff.length > 0 ? boardStaff : staffList}
        onConfirm={handleConfirmDetail}
        onPayment={handlePayDetail}
        onWhatsAppOpen={handleWhatsAppOpen}
        onCancelDialogOpen={() => setCancelOpen(true)}
        restrictStaffWorkflow={isStaffSession}
        onAppointmentEdited={refreshAndSync}
      />

      <CancelAppointmentConfirm
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        busy={busy}
        onConfirm={handleCancelConfirm}
      />
    </div>
  );
}
