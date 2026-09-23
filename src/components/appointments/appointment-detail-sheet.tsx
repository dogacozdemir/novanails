"use client";

import { CalendarCheck, ChevronDown, Trash2, X } from "lucide-react";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.mjs";
import ClipboardCheck from "lucide-react/dist/esm/icons/clipboard-check.mjs";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import Phone from "lucide-react/dist/esm/icons/phone.mjs";
import Send from "lucide-react/dist/esm/icons/send.mjs";
import Slash from "lucide-react/dist/esm/icons/slash.mjs";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@radix-ui/react-alert-dialog";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteAppointment,
  getAvailableSlots,
  updateAppointmentFull,
  type CustomerBrief,
  type EnrichedAppointment,
  type RecordPaymentPayload,
  type ServiceBrief,
  type StaffBrief,
} from "@/app/appointments/actions";
import {
  getCustomerFullAppointmentHistory,
  type CustomerHistoryMinimal,
} from "@/app/customers/actions";
import type { AppointmentStatus, UserRole } from "@/types/database";

import { Button, buttonVariants } from "@/components/ui/button";
import { GlassSheet } from "@/components/ui/glass-sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR,
  APPOINTMENT_OVERLAP_ERROR,
} from "@/lib/appointment-errors";
import { buildTelHref, buildWhatsAppConfirmationLink } from "@/lib/whatsapp";
import {
  NOVA_DIALOG_DESCRIPTION,
  NOVA_DIALOG_TITLE,
  NOVA_GLASS_DIALOG_OVERLAY_STACKED,
  NOVA_GLASS_DIALOG_PANEL_STACKED,
} from "@/lib/glass-dialog-classes";
import { cn } from "@/lib/utils";

import { formatDateTRLong, normalizeDisplayTime } from "@/lib/time";

const AppointmentCheckoutDialog = dynamic(
  () =>
    import("@/components/appointments/appointment-checkout-dialog").then(
      (m) => m.AppointmentCheckoutDialog
    ),
  { ssr: false, loading: () => null }
);

const CustomerCombobox = dynamic(
  () =>
    import("@/components/customers/customer-combobox").then(
      (m) => m.CustomerCombobox
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 w-full animate-pulse rounded-xl bg-muted/35" />
    ),
  }
);

function statusMeta(status: AppointmentStatus): {
  label: string;
  Icon: typeof Clock;
  tone: string;
} {
  switch (status) {
    case "waiting":
      return {
        label: "Teyit bekliyor",
        Icon: Clock,
        tone: "bg-[#FBBF24]/18 text-[#b45309] ring-1 ring-[#FBBF24]/35",
      };
    case "message_sent":
      return {
        label: "Mesaj gönderildi",
        Icon: Send,
        tone: "bg-[#3B82F6]/18 text-[#1e40af] ring-1 ring-[#3B82F6]/40 dark:text-[#bfdbfe]",
      };
    case "confirmed":
      return {
        label: "Teyitlendi",
        Icon: CheckCircle2,
        tone: "bg-[#10B981]/18 text-[#047857] ring-1 ring-[#10B981]/35",
      };
    case "cancelled":
      return {
        label: "İptal",
        Icon: Slash,
        tone: "bg-[#EF4444]/15 text-[#b91c1c] ring-1 ring-[#EF4444]/35",
      };
    case "completed":
      return {
        label: "Tamamlandı",
        Icon: ClipboardCheck,
        tone: "bg-slate-400/20 text-slate-700 ring-1 ring-slate-400/40 dark:text-slate-200",
      };
    default:
      return {
        label: status,
        Icon: Clock,
        tone: "bg-muted text-muted-foreground",
      };
  }
}

const STATUS_SELECT_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "waiting", label: "Teyit bekliyor" },
  { value: "message_sent", label: "Mesaj gönderildi" },
  { value: "confirmed", label: "Teyitlendi" },
  { value: "cancelled", label: "İptal" },
  { value: "completed", label: "Tamamlandı" },
];

const BAR_H = "min-h-[44px]";

type AppointmentDetailSheetProps = {
  appointment: EnrichedAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeLabel: string;
  busy: boolean;
  customers: CustomerBrief[];
  services: ServiceBrief[];
  staff: StaffBrief[];
  onConfirm: () => Promise<void>;
  onPayment: (payload: RecordPaymentPayload) => Promise<void>;
  /** WhatsApp açılmadan önce (örn. waiting → message_sent); sonra wa.me yeni sekmede açılır */
  onWhatsAppOpen?: () => Promise<void>;
  onCancelDialogOpen: () => void;
  /** staff: yalnızca ödeme ile tamamlama; teyit / WhatsApp / iptal kapalı */
  restrictStaffWorkflow?: boolean;
  sessionRole?: UserRole;
  /** Randevu güncelleme sonrası tahta yenileme */
  onAppointmentEdited?: () => void | Promise<void>;
};

export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
  timeLabel,
  busy,
  customers,
  services,
  staff,
  onConfirm,
  onPayment,
  onWhatsAppOpen,
  onCancelDialogOpen,
  restrictStaffWorkflow = false,
  sessionRole = "admin",
  onAppointmentEdited,
}: AppointmentDetailSheetProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStaffId, setEditStaffId] = useState("");
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [editServiceId, setEditServiceId] = useState("");
  const [editDateISO, setEditDateISO] = useState("");
  const [editTime, setEditTime] = useState("10:00");
  const [editDuration, setEditDuration] = useState("120");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<AppointmentStatus>("waiting");
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null);
  const [deletePermOpen, setDeletePermOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<
    CustomerHistoryMinimal[]
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPending, startHistoryTransition] = useTransition();

  useEffect(() => {
    setCheckoutOpen(false);
    setEditOpen(false);
    setDeletePermOpen(false);
    setAvailableSlots(null);
    setCustomerHistory([]);
    setHistoryOpen(false);
  }, [appointment?.id]);

  useEffect(() => {
    if (!open) {
      setHistoryOpen(false);
    }
  }, [open]);

  useEffect(() => {
    setAvailableSlots(null);
  }, [editStaffId, editDateISO, editDuration]);

  const openCheckout = () => {
    if (!appointment) return;
    setCheckoutOpen(true);
  };

  if (!appointment) return null;

  const customerName = appointment.customer
    ? `${appointment.customer.name} ${appointment.customer.surname}`
    : "—";

  const toggleCustomerHistory = () => {
    if (!appointment.customer_id) return;
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    const customerId = appointment.customer_id;
    startHistoryTransition(() => {
      void getCustomerFullAppointmentHistory(customerId)
        .then((rows) => {
          setCustomerHistory(rows);
          setHistoryOpen(true);
        })
        .catch((e) => {
          toast.error("Randevu geçmişi yüklenemedi", {
            description: e instanceof Error ? e.message : undefined,
          });
        });
    });
  };

  const serviceName = appointment.service?.name ?? "—";

  const firstName = appointment.customer?.name ?? "Misafir";
  const wa = buildWhatsAppConfirmationLink(
    appointment.customer?.phone,
    firstName,
    formatDateTRLong(appointment.appointment_date),
    timeLabel
  );
  const telHref = buildTelHref(appointment.customer?.phone);

  const meta = statusMeta(appointment.status);
  const StatusIcon = meta.Icon;

  const staffLimited = restrictStaffWorkflow;

  const canConfirm =
    !staffLimited &&
    (appointment.status === "waiting" ||
      appointment.status === "message_sent");
  const canPay =
    appointment.status === "waiting" ||
    appointment.status === "message_sent" ||
    appointment.status === "confirmed";
  const canCancel =
    !staffLimited &&
    appointment.status !== "cancelled" &&
    appointment.status !== "completed";

  const canEditFull =
    sessionRole === "admin" ||
    (sessionRole === "staff" &&
      appointment.status !== "cancelled" &&
      appointment.status !== "completed");

  const openEditDialog = () => {
    setEditStaffId(appointment.staff_id);
    setEditCustomerId(appointment.customer_id);
    setEditServiceId(appointment.service_id);
    setEditDateISO(appointment.appointment_date);
    setEditTime(normalizeDisplayTime(appointment.appointment_time));
    setEditDuration(String(appointment.planned_duration ?? 120));
    setEditNotes(appointment.notes ?? "");
    setEditStatus(appointment.status);
    setEditError(null);
    setAvailableSlots(null);
    setEditOpen(true);
  };

  const loadAvailableSlots = async () => {
    if (!editStaffId.trim()) {
      toast.error("Uzman seçin", {
        description: "Müsait saatler için bir uzman seçmelisiniz.",
      });
      return;
    }
    const planned = Math.max(
      1,
      Math.round(parseFloat(editDuration.replace(",", ".")) || 120)
    );
    if (!Number.isFinite(planned) || planned < 1) {
      toast.error("Geçersiz süre", {
        description: "Önce geçerli bir dakika değeri girin.",
      });
      return;
    }
    setSlotsLoading(true);
    setEditError(null);
    try {
      const { slots } = await getAvailableSlots(
        editDateISO,
        editStaffId,
        planned
      );
      setAvailableSlots(slots);
      if (slots.length === 0) {
        toast.error("Uygun saat bulunamadı", {
          description:
            "Bu tarih ve uzman için takvimde boşluk yok. Süreyi veya tarihi değiştirmeyi deneyin.",
        });
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Müsait saatler yüklenemedi.";
      toast.error("Müsait saatler alınamadı", { description: msg });
    } finally {
      setSlotsLoading(false);
    }
  };

  const submitEdit = async () => {
    if (!services.length) {
      setEditError("Önce en az bir hizmet tanımlayın.");
      return;
    }
    if (!editStaffId.trim()) {
      setEditError("Uzman seçimi zorunludur.");
      return;
    }
    if (!staff.some((s) => s.id === editStaffId)) {
      setEditError("Geçersiz uzman seçimi.");
      return;
    }
    if (!editCustomerId || !editServiceId) {
      setEditError("Müşteri ve hizmet seçimi zorunludur.");
      return;
    }
    const planned = Math.max(
      1,
      Math.round(parseFloat(editDuration.replace(",", ".")) || 120)
    );
    if (!Number.isFinite(planned) || planned < 1) {
      setEditError("Süre için geçerli bir dakika değeri girin (en az 1).");
      return;
    }

    setEditError(null);
    setEditBusy(true);
    try {
      const payload = {
        staff_id: editStaffId,
        customer_id: editCustomerId,
        service_id: editServiceId,
        appointment_date: editDateISO,
        appointment_time: editTime,
        planned_duration: planned,
        notes: editNotes.trim() || null,
        ...(sessionRole === "admin" ? { status: editStatus } : {}),
      };
      await updateAppointmentFull(appointment.id, payload);
      toast.success("Randevu güncellendi.");
      await onAppointmentEdited?.();
      setEditOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Güncellenemedi.";
      if (
        msg === APPOINTMENT_OVERLAP_ERROR ||
        msg.includes("çakışıyor")
      ) {
        toast.error("Bu zaman dilimi uygun değil", {
          description:
            "Seçilen saat ve süre, uzmanın dolu olduğu bir aralıkla çakışıyor.",
        });
        setEditError(null);
      } else if (msg === APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR) {
        toast.error("Slot dolu", { description: msg });
        setEditError(null);
      } else {
        setEditError(msg);
      }
    } finally {
      setEditBusy(false);
    }
  };

  const submitPermanentDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteAppointment(appointment.id);
      toast.success("Randevu kalıcı olarak silindi.");
      setDeletePermOpen(false);
      onOpenChange(false);
      await onAppointmentEdited?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Randevu silinemedi."
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <GlassSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Randevu detayı"
        description={`${formatDateTRLong(appointment.appointment_date)} · ${timeLabel}`}
      >
        <div className="flex flex-1 flex-col gap-6">
          {appointment.notes?.trim() ? (
            <div className="liquid-glass-v2 rounded-[1.2rem] border border-white/35 px-4 py-4 shadow-diffuse ring-1 ring-[var(--glass-border)] dark:border-white/12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Notlar
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--nova-charcoal)] dark:text-foreground">
                {appointment.notes.trim()}
              </p>
            </div>
          ) : null}
          <div
            className={cn(
              "glass-surface rounded-2xl p-4 transition-glass",
              appointment.status === "cancelled" &&
                "relative border-[#EF4444]/40 bg-[#EF4444]/[0.07]"
            )}
          >
            {appointment.status === "cancelled" ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-[#EF4444]/55"
              />
            ) : null}
            <div
              className={cn(
                "relative space-y-3",
                appointment.status === "cancelled" &&
                  "opacity-[0.92] [text-decoration-thickness:1px]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Müşteri
                  </p>
                  {appointment.customer_id ? (
                    <button
                      type="button"
                      onClick={toggleCustomerHistory}
                      aria-expanded={historyOpen}
                      className={cn(
                        "group mt-0.5 inline-flex max-w-full items-center gap-1.5 text-left font-medium text-foreground transition-colors hover:text-primary",
                        appointment.status === "cancelled" &&
                          "text-foreground/85 line-through decoration-[#EF4444]/90 decoration-[1.5px] hover:text-foreground/85"
                      )}
                    >
                      <span className="truncate">{customerName}</span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-primary",
                          historyOpen && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <p
                      className={cn(
                        "font-medium text-foreground",
                        appointment.status === "cancelled" &&
                          "text-foreground/85 line-through decoration-[#EF4444]/90 decoration-[1.5px]"
                      )}
                    >
                      {customerName}
                    </p>
                  )}
                  {appointment.customer_id && !historyOpen ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Geçmiş randevular için isme tıklayın
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                    meta.tone
                  )}
                >
                  <StatusIcon className="size-3.5" aria-hidden />
                  {meta.label}
                </span>
              </div>

              {historyOpen && appointment.customer_id ? (
                <div className="space-y-2 border-t border-white/10 pt-3 dark:border-white/[0.08]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                    Müşterinin tüm randevuları
                  </p>
                  {historyPending ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Yükleniyor…
                    </div>
                  ) : customerHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70">
                      Kayıtlı randevu yok.
                    </p>
                  ) : (
                    <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {customerHistory.map((h) => {
                        const hm = statusMeta(h.status);
                        const HistIcon = hm.Icon;
                        const isCurrent = h.id === appointment.id;
                        return (
                          <li
                            key={h.id}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.03]",
                              isCurrent &&
                                "border-primary/35 bg-primary/[0.06] ring-1 ring-primary/25"
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground/90">
                                {h.service_name}
                                {isCurrent ? (
                                  <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                    · bu randevu
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                                {formatDateTRLong(h.appointment_date)} ·{" "}
                                {normalizeDisplayTime(h.appointment_time)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                hm.tone
                              )}
                            >
                              <HistIcon className="size-3" aria-hidden />
                              {hm.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Hizmet
                </p>
                <p
                  className={cn(
                    "text-sm font-medium text-foreground",
                    appointment.status === "cancelled" &&
                      "line-through decoration-[#EF4444]/90 decoration-[1.5px]"
                  )}
                >
                  {serviceName}
                </p>
                {appointment.status !== "completed" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ücret, işlem bitirirken kaydedilir.
                  </p>
                ) : !staffLimited && appointment.final_price != null ? (
                  <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
                    Tahsil edilen:{" "}
                    {appointment.final_price.toLocaleString("tr-TR", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ₺
                  </p>
                ) : staffLimited ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Randevu tamamlandı.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tamamlandı.
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Planlanan blok: {appointment.planned_duration} dk
                </p>
              </div>

              {appointment.staff_notes ? (
                <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Personel notu
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {appointment.staff_notes}
                  </p>
                </div>
              ) : null}

              {appointment.customer?.notes ? (
                <div className="rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Müşteriye özel kalıcı not
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {appointment.customer.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {canEditFull ? (
              <Button
                type="button"
                variant="outline"
                className={cn(BAR_H, "w-full justify-center rounded-xl border-[var(--glass-border)]")}
                disabled={busy || editBusy}
                onClick={openEditDialog}
              >
                Randevu düzenle
              </Button>
            ) : null}
            {sessionRole === "admin" ? (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  BAR_H,
                  "w-full justify-center rounded-xl border-destructive/45 text-destructive hover:bg-destructive/10"
                )}
                disabled={busy || deleteBusy || editBusy}
                onClick={() => setDeletePermOpen(true)}
              >
                <Trash2 className="mr-2 size-4" aria-hidden />
                Randevuyu kalıcı olarak sil
              </Button>
            ) : null}
            {!staffLimited ? (
              <Button
                type="button"
                className={cn(BAR_H, "w-full justify-center rounded-xl shadow-glass-inner")}
                disabled={!canConfirm || busy}
                onClick={() => void onConfirm()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Teyit Alındı"
                )}
              </Button>
            ) : null}
            {telHref || (!staffLimited && wa) ? (
              <div className="flex flex-wrap gap-2">
                {telHref ? (
                  <a
                    href={telHref}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "inline-flex min-h-11 min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-xl py-2.5"
                    )}
                  >
                    <Phone className="size-4 text-primary" aria-hidden />
                    Telefon
                  </a>
                ) : null}
                {!staffLimited && wa ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 min-w-[8rem] flex-1 justify-center gap-2 rounded-xl py-2.5"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        await onWhatsAppOpen?.();
                        window.open(wa, "_blank", "noopener,noreferrer");
                      })()
                    }
                  >
                    <MessageCircle className="size-4 text-emerald-600" />
                    WhatsApp
                  </Button>
                ) : null}
              </div>
            ) : null}
            {!staffLimited && !wa && !telHref ? (
              <p className="text-center text-xs text-muted-foreground">
                WhatsApp ve arama için müşteri telefonu ekleyin.
              </p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className={cn(BAR_H, "w-full justify-center rounded-xl shadow-glass-inner")}
              disabled={!canPay || busy}
              onClick={() => openCheckout()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "İşlemi Bitir"
              )}
            </Button>
            {!staffLimited ? (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  BAR_H,
                  "w-full justify-center rounded-xl border-[#EF4444]/35 text-[#b91c1c] hover:bg-[#EF4444]/10"
                )}
                disabled={!canCancel || busy}
                onClick={onCancelDialogOpen}
              >
                İptal Et
              </Button>
            ) : null}
          </div>
        </div>
      </GlassSheet>

      <AppointmentCheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        appointment={appointment}
        busy={busy}
        restrictStaffWorkflow={staffLimited}
        onPayment={onPayment}
      />

      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={NOVA_GLASS_DIALOG_OVERLAY_STACKED} />
          <Dialog.Content
            className={cn(
              NOVA_GLASS_DIALOG_PANEL_STACKED,
              "max-h-[min(calc(100vh-2rem),40rem)] overflow-y-auto"
            )}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className={NOVA_DIALOG_TITLE}>
                Randevu düzenle
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="min-h-11 min-w-11 shrink-0 rounded-xl"
                  aria-label="Kapat"
                >
                  <X className="size-5" aria-hidden />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className={NOVA_DIALOG_DESCRIPTION}>
              {formatDateTRLong(appointment.appointment_date)} — tüm temel alanları
              güncelleyebilirsiniz.
            </Dialog.Description>

            <div className="mt-6 flex flex-col gap-5">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Tarih <span className="text-destructive">*</span>
                </span>
                <Input
                  type="date"
                  value={editDateISO}
                  onChange={(e) => setEditDateISO(e.target.value)}
                  disabled={editBusy}
                  className={cn(
                    BAR_H,
                    "rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 font-sans text-sm backdrop-blur-xl"
                  )}
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Uzman <span className="text-destructive">*</span>
                </span>
                {staff.length === 0 ? (
                  <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-xs text-amber-950 dark:text-amber-50">
                    Uzman yok.{" "}
                    <Link
                      href="/settings"
                      className="font-semibold underline underline-offset-2"
                    >
                      Ayarlardan
                    </Link>{" "}
                    ekleyin.
                  </p>
                ) : (
                  <select
                    required
                    className={cn(
                      BAR_H,
                      "flex w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl",
                      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    )}
                    value={editStaffId}
                    onChange={(e) => setEditStaffId(e.target.value)}
                    disabled={editBusy || staffLimited}
                  >
                    <option value="">Uzman seçin</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                {staffLimited ? (
                  <p className="text-[11px] text-muted-foreground">
                    Yalnızca kendi takviminize ait randevuları düzenleyebilirsiniz.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Saat
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      editBusy ||
                      slotsLoading ||
                      staff.length === 0 ||
                      !editStaffId.trim()
                    }
                    onClick={() => void loadAvailableSlots()}
                    className={cn(
                      "h-11 min-h-[44px] shrink-0 gap-2 rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)]/88 shadow-sm backdrop-blur-xl",
                      "hover:bg-[#f5f1e9]/75 dark:hover:bg-white/[0.08]"
                    )}
                  >
                    {slotsLoading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <CalendarCheck className="size-4" aria-hidden />
                    )}
                    <span className="font-sans text-xs font-semibold tracking-wide">
                      Müsait saatleri göster
                    </span>
                  </Button>
                </div>
                <input
                  type="time"
                  step={300}
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  disabled={editBusy}
                  className={cn(
                    BAR_H,
                    "flex w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 font-mono text-sm tabular-nums backdrop-blur-xl",
                    "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  )}
                />
                {availableSlots !== null && availableSlots.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="size-3 shrink-0" aria-hidden />
                      Müsait saatler — dokunarak seçin
                    </p>
                    <div
                      className={cn(
                        "flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]",
                        "[&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20"
                      )}
                      role="list"
                    >
                      {availableSlots.map((slot) => {
                        const picked =
                          normalizeDisplayTime(editTime) === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            role="listitem"
                            onClick={() => setEditTime(slot)}
                            disabled={editBusy}
                            className={cn(
                              "min-h-11 shrink-0 rounded-xl border px-3 py-2 font-mono text-xs font-medium tabular-nums backdrop-blur-xl",
                              "border-[var(--glass-border)] bg-[var(--glass-bg)]/90",
                              picked &&
                                "border-primary/55 bg-primary/12 ring-1 ring-primary/30"
                            )}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Müşteri
                </span>
                <CustomerCombobox
                  customers={customers}
                  value={editCustomerId}
                  onChange={setEditCustomerId}
                  disabled={editBusy}
                  compactQuickAdd
                  minimalInlineForm
                  onCustomerListChange={async () => {
                    await onAppointmentEdited?.();
                  }}
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Hizmet
                </span>
                {services.length === 0 ? (
                  <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-xs text-amber-950 dark:text-amber-50">
                    Hizmet yok.{" "}
                    <Link
                      href="/services"
                      className="font-semibold underline underline-offset-2"
                    >
                      Hizmetler
                    </Link>
                    &apos;den ekleyin.
                  </p>
                ) : (
                  <select
                    className={cn(
                      BAR_H,
                      "flex w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl",
                      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    )}
                    value={editServiceId}
                    onChange={(e) => setEditServiceId(e.target.value)}
                    disabled={editBusy}
                  >
                    <option value="">Seçin</option>
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Süre (dakika) <span className="text-destructive">*</span>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={5}
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  disabled={editBusy}
                  className={cn(
                    BAR_H,
                    "flex w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 font-mono text-sm tabular-nums backdrop-blur-xl"
                  )}
                />
              </div>

              {sessionRole === "admin" ? (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Durum
                  </span>
                  <select
                    className={cn(
                      BAR_H,
                      "flex w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl",
                      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    )}
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as AppointmentStatus)
                    }
                    disabled={editBusy}
                  >
                    {STATUS_SELECT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Randevu notu
                </span>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="İsteğe bağlı"
                  disabled={editBusy}
                  className="min-h-[100px] rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)]"
                />
              </div>

              {editError ? (
                <p className="text-sm text-destructive">{editError}</p>
              ) : null}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(BAR_H, "flex-1 rounded-xl")}
                  disabled={editBusy}
                  onClick={() => setEditOpen(false)}
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  className={cn(BAR_H, "flex-1 rounded-xl shadow-glass-inner")}
                  disabled={
                    editBusy ||
                    services.length === 0 ||
                    staff.length === 0 ||
                    !editStaffId.trim()
                  }
                  onClick={() => void submitEdit()}
                >
                  {editBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Kaydet"
                  )}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <DeleteAppointmentPermanentConfirm
        open={deletePermOpen}
        onOpenChange={setDeletePermOpen}
        busy={deleteBusy}
        onConfirm={() => void submitPermanentDelete()}
      />
    </>
  );
}

/** İptal onayı — AlertDialog içeriği bu bileşende tutulur (portal çakışması için ayrı kök). */
export function CancelAppointmentConfirm({
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  busy: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay className="fixed inset-0 z-[110] bg-black/35 backdrop-blur-md will-change-[opacity] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialogContent className="liquid-glass-v2 shadow-diffuse fixed left-1/2 top-1/2 z-[111] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 -translate-y-1/2 rounded-[1.35rem] border border-[var(--glass-border)] p-6 ring-1 ring-[var(--glass-border)] focus:outline-none dark:border-white/12">
          <AlertDialogTitle className={NOVA_DIALOG_TITLE}>
            Randevuyu iptal et
          </AlertDialogTitle>
          <AlertDialogDescription className={NOVA_DIALOG_DESCRIPTION}>
            Bu randevu iptal edilecek ve liste üzerinde iptal durumuna geçecektir.
            Emin misiniz?
          </AlertDialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 rounded-xl"
              disabled={busy}
              onClick={() => void onConfirm().then(() => onOpenChange(false))}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Evet, iptal et"
              )}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}

export function DeleteAppointmentPermanentConfirm({
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  busy: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay className="fixed inset-0 z-[112] bg-black/35 backdrop-blur-md will-change-[opacity] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialogContent className="liquid-glass-v2 shadow-diffuse fixed left-1/2 top-1/2 z-[113] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 -translate-y-1/2 rounded-[1.35rem] border border-[var(--glass-border)] p-6 ring-1 ring-[var(--glass-border)] focus:outline-none dark:border-white/12">
          <AlertDialogTitle className={NOVA_DIALOG_TITLE}>
            Randevuyu kalıcı olarak sil
          </AlertDialogTitle>
          <AlertDialogDescription className={NOVA_DIALOG_DESCRIPTION}>
            Bu işlem geri alınamaz ve ilişkili tüm finans verileri silinecektir.
          </AlertDialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 rounded-xl"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Evet, sil"
              )}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
