"use client";

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
import { useEffect, useState } from "react";

import {
  updateAppointmentTimeAndNotes,
  type EnrichedAppointment,
  type RecordPaymentPayload,
} from "@/app/appointments/actions";
import type { AppointmentStatus, UserRole } from "@/types/database";

import { Button, buttonVariants } from "@/components/ui/button";
import { GlassSheet } from "@/components/ui/glass-sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type AppointmentDetailSheetProps = {
  appointment: EnrichedAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeLabel: string;
  busy: boolean;
  onConfirm: () => Promise<void>;
  onPayment: (payload: RecordPaymentPayload) => Promise<void>;
  /** WhatsApp açılmadan önce (örn. waiting → message_sent); sonra wa.me yeni sekmede açılır */
  onWhatsAppOpen?: () => Promise<void>;
  onCancelDialogOpen: () => void;
  /** staff: yalnızca ödeme ile tamamlama; teyit / WhatsApp / iptal kapalı */
  restrictStaffWorkflow?: boolean;
  sessionRole?: UserRole;
  /** Randevu saat/not güncellemesi sonrası tahta yenileme */
  onAppointmentEdited?: () => void | Promise<void>;
};

export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
  timeLabel,
  busy,
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
  const [editTime, setEditTime] = useState("10:00");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    setCheckoutOpen(false);
    setEditOpen(false);
  }, [appointment?.id]);

  const openCheckout = () => {
    if (!appointment) return;
    setCheckoutOpen(true);
  };

  if (!appointment) return null;

  const customerName = appointment.customer
    ? `${appointment.customer.name} ${appointment.customer.surname}`
    : "—";
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

  const canEditSchedule =
    appointment.status !== "cancelled" &&
    (sessionRole === "admin" ||
      (sessionRole === "staff" && appointment.status !== "completed"));

  const openEditDialog = () => {
    setEditTime(normalizeDisplayTime(appointment.appointment_time));
    setEditNotes(appointment.notes ?? "");
    setEditError(null);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    setEditError(null);
    setEditBusy(true);
    try {
      await updateAppointmentTimeAndNotes(appointment.id, {
        appointment_time: editTime,
        notes: editNotes.trim() || null,
      });
      await onAppointmentEdited?.();
      setEditOpen(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Güncellenemedi.");
    } finally {
      setEditBusy(false);
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
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Müşteri
                </p>
                <p
                  className={cn(
                    "font-medium text-foreground",
                    appointment.status === "cancelled" &&
                      "text-foreground/85 line-through decoration-[#EF4444]/90 decoration-[1.5px]"
                  )}
                >
                  {customerName}
                </p>
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
          {canEditSchedule ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center rounded-xl border-[var(--glass-border)]"
              disabled={busy || editBusy}
              onClick={openEditDialog}
            >
              Saat ve notları düzenle
            </Button>
          ) : null}
          {!staffLimited ? (
            <Button
              type="button"
              className="w-full justify-center rounded-xl shadow-glass-inner"
              disabled={!canConfirm || busy}
              onClick={() => void onConfirm()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Teyit Alındı"
              )}
            </Button>
          ) : null}
          {(telHref || (!staffLimited && wa)) ? (
            <div className="flex flex-wrap gap-2">
              {telHref ? (
                <a
                  href={telHref}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "inline-flex min-h-10 min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-xl py-2.5"
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
                  className="min-h-10 min-w-[8rem] flex-1 justify-center gap-2 rounded-xl py-2.5"
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
            className="w-full justify-center rounded-xl shadow-glass-inner"
            disabled={!canPay || busy}
            onClick={() => openCheckout()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "İşlemi Bitir"
            )}
          </Button>
          {!staffLimited ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center rounded-xl border-[#EF4444]/35 text-[#b91c1c] hover:bg-[#EF4444]/10"
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
          className={NOVA_GLASS_DIALOG_PANEL_STACKED}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className={NOVA_DIALOG_TITLE}>
            Saat ve notlar
          </Dialog.Title>
          <Dialog.Description className={NOVA_DIALOG_DESCRIPTION}>
            Randevu başlangıç saati ile görünür notları güncelleyin.
          </Dialog.Description>

          <div className="mt-6 flex flex-col gap-4">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Başlangıç saati
              </label>
              <Input
                type="time"
                step={300}
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                disabled={editBusy}
                className="rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)] font-mono tabular-nums"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Randevu notu
              </label>
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
                className="flex-1 rounded-xl"
                disabled={editBusy}
                onClick={() => setEditOpen(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl shadow-glass-inner"
                disabled={editBusy}
                onClick={() => void submitEdit()}
              >
                {editBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Kaydet"
                )}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
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
