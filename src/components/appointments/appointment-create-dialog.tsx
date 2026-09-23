"use client";

import { CalendarCheck, Clock, Loader2, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  createAppointment,
  getAvailableSlots,
  type CustomerBrief,
  type ServiceBrief,
  type StaffBrief,
} from "@/app/appointments/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR,
  APPOINTMENT_OVERLAP_ERROR,
} from "@/lib/appointment-errors";
import {
  NOVA_DIALOG_DESCRIPTION,
  NOVA_DIALOG_TITLE,
  NOVA_GLASS_DIALOG_OVERLAY,
  NOVA_GLASS_DIALOG_PANEL,
} from "@/lib/glass-dialog-classes";
import { formatDateTRLong, normalizeDisplayTime } from "@/lib/time";
import { cn } from "@/lib/utils";

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

export type CreateAppointmentContext = {
  staffId: string;
  slotTime: string;
};

type AppointmentCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: CreateAppointmentContext | null;
  selectedDateISO: string;
  staff: StaffBrief[];
  customers: CustomerBrief[];
  services: ServiceBrief[];
  /** Kendi takvimine kilitle; uzman seçimini devre dışı bırakır */
  isStaffSession?: boolean;
  onSuccess: () => Promise<void> | void;
};

export function AppointmentCreateDialog({
  open,
  onOpenChange,
  ctx,
  selectedDateISO,
  staff,
  customers,
  services,
  isStaffSession = false,
  onSuccess,
}: AppointmentCreateDialogProps) {
  const [staffId, setStaffId] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [timeValue, setTimeValue] = useState("10:00");
  /** Takvim blok süresi (dk) — varsayılan 120 */
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) {
      setCustomerId(null);
      setStaffId("");
      setServiceId(services[0]?.id ?? "");
      setDurationMinutes("120");
      setNotes("");
      setError(null);
      setAvailableSlots(null);
      setSlotsLoading(false);
    }
  }, [open, services]);

  useEffect(() => {
    if (open && ctx?.slotTime) {
      setTimeValue(normalizeDisplayTime(ctx.slotTime));
    }
  }, [open, ctx?.slotTime]);

  useEffect(() => {
    if (open && ctx?.staffId) {
      setStaffId(ctx.staffId);
    }
  }, [open, ctx?.staffId]);

  useEffect(() => {
    if (open && services.length && !serviceId) {
      setServiceId(services[0].id);
    }
  }, [open, services, serviceId]);

  useEffect(() => {
    setAvailableSlots(null);
  }, [staffId, selectedDateISO, durationMinutes]);

  const loadAvailableSlots = async () => {
    if (!staffId.trim()) {
      toast.error("Uzman seçin", {
        description:
          "Müsait saatleri görmek için listeden bir uzman seçmelisiniz.",
      });
      return;
    }
    const planned = Math.max(
      1,
      Math.round(parseFloat(durationMinutes.replace(",", ".")) || 120)
    );
    if (!Number.isFinite(planned) || planned < 1) {
      toast.error("Geçersiz süre", {
        description: "Önce randevu süresi için geçerli bir dakika değeri girin.",
      });
      return;
    }
    setSlotsLoading(true);
    setError(null);
    try {
      const { slots } = await getAvailableSlots(
        selectedDateISO,
        staffId,
        planned
      );
      setAvailableSlots(slots);
      if (slots.length === 0) {
        toast.error("Uygun saat bulunamadı", {
          description:
            "Bu tarih, uzman ve süre için takvimde boşluk yok. Süreyi veya tarihi değiştirmeyi deneyin.",
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

  const submit = async () => {
    if (!ctx) {
      setError("Randevu bağlamı eksik.");
      return;
    }
    if (!services.length) {
      setError("Önce salon ayarlarından en az bir hizmet ekleyin.");
      return;
    }
    if (!staffId.trim()) {
      setError("Uzman seçimi zorunludur.");
      return;
    }
    if (!staff.some((s) => s.id === staffId)) {
      setError("Geçersiz uzman seçimi.");
      return;
    }
    if (!customerId || !serviceId) {
      setError("Müşteri ve hizmet seçimi zorunludur.");
      return;
    }
    const planned = Math.max(
      1,
      Math.round(parseFloat(durationMinutes.replace(",", ".")) || 120)
    );
    if (!Number.isFinite(planned) || planned < 1) {
      setError("Süre için geçerli bir dakika değeri girin (en az 1).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAppointment({
        staff_id: staffId,
        appointment_date: selectedDateISO,
        appointment_time: timeValue,
        customer_id: customerId,
        service_id: serviceId,
        appointment_notes: notes.trim() || null,
        staff_notes: null,
        planned_duration: planned,
      });
      await onSuccess();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Kayıt oluşturulamadı.";
      if (
        msg === APPOINTMENT_OVERLAP_ERROR ||
        msg.includes("çakışıyor")
      ) {
        toast.error("Bu zaman dilimi uygun değil", {
          description:
            "Seçilen saat ve planlanan süre, uzmanın dolu olduğu bir aralıkla çakışıyor. Lütfen başka bir saat veya süre seçin.",
        });
        setError(null);
      } else {
        const dup =
          msg.includes("duplicate") ||
          msg.includes("unique") ||
          msg.includes("23505") ||
          msg === APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR;
        setError(dup ? APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR : msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={NOVA_GLASS_DIALOG_OVERLAY} />
        <Dialog.Content
          className={NOVA_GLASS_DIALOG_PANEL}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className={NOVA_DIALOG_TITLE}>
              Yeni randevu
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-xl"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className={NOVA_DIALOG_DESCRIPTION}>
            {ctx ? `${formatDateTRLong(selectedDateISO)}` : ""}
          </Dialog.Description>

          <div className="mt-6 flex flex-col gap-5">
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Uzman <span className="text-destructive">*</span>
              </span>
              {staff.length === 0 ? (
                <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-xs leading-relaxed text-amber-950 dark:text-amber-50">
                  Kayıtlı uzman yok.{" "}
                  {isStaffSession ? (
                    "Yöneticinize başvurun."
                  ) : (
                    <>
                      <Link
                        href="/settings"
                        className="font-semibold underline underline-offset-2 hover:text-foreground"
                      >
                        Salon ayarları
                      </Link>
                      &nbsp;üzerinden uzman ekleyin.
                    </>
                  )}
                </p>
              ) : (
                <select
                  required
                  className={cn(
                    "flex h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl",
                    "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  )}
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  disabled={submitting || isStaffSession}
                >
                  <option value="">Uzman seçin</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-muted-foreground">
                {isStaffSession
                  ? "Randevular yalnızca sizin takviminize eklenir."
                  : "Takvimden uzman sütununa tıklayarak açtıysanız ilgili uzman önceden seçilir; buradan değiştirebilirsiniz."}
              </p>
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
                    submitting ||
                    slotsLoading ||
                    staff.length === 0 ||
                    !staffId.trim()
                  }
                  onClick={() => void loadAvailableSlots()}
                  className={cn(
                    "h-9 shrink-0 gap-2 rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)]/88 shadow-sm backdrop-blur-xl",
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
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                disabled={submitting}
                className={cn(
                  "flex h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 font-mono text-sm tabular-nums backdrop-blur-xl",
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
                      "flex gap-2 overflow-x-auto pb-2 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]",
                      "[&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20"
                    )}
                    role="list"
                    aria-label="Müsait randevu saatleri"
                  >
                    {availableSlots.map((slot) => {
                      const picked = normalizeDisplayTime(timeValue) === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          role="listitem"
                          onClick={() => setTimeValue(slot)}
                          disabled={submitting}
                          className={cn(
                            "shrink-0 rounded-xl border px-3 py-2 font-mono text-xs font-medium tabular-nums backdrop-blur-xl transition-colors",
                            "border-[var(--glass-border)] bg-[var(--glass-bg)]/90 shadow-[0_10px_28px_-14px_rgba(0,0,0,0.22)]",
                            "ring-1 ring-white/40 hover:bg-white/55 dark:ring-white/10 dark:hover:bg-white/[0.12]",
                            picked &&
                              "border-primary/55 bg-primary/12 ring-primary/30"
                          )}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                Dakika hassasiyetiyle randevu saati (ör. 11:15, 13:45).
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Müşteri
              </span>
              <CustomerCombobox
                customers={customers}
                value={customerId}
                onChange={setCustomerId}
                disabled={submitting}
                compactQuickAdd
                minimalInlineForm
                onCustomerListChange={async () => {
                  await onSuccess();
                }}
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Hizmet
              </span>
              {services.length === 0 ? (
                <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-xs leading-relaxed text-amber-950 dark:text-amber-50">
                  Kayıtlı hizmet bulunmuyor.{" "}
                  {isStaffSession ? (
                    "Yöneticinize başvurun."
                  ) : (
                    <>
                      <Link
                        href="/services"
                        className="font-semibold underline underline-offset-2 hover:text-foreground"
                      >
                        Salon ayarları → Hizmetler
                      </Link>{" "}
                      sekmesinden hizmet ekleyin; liste Supabase&apos;teki güncel
                      kayıtlardan gelir.
                    </>
                  )}
                </p>
              ) : (
                <select
                  className={cn(
                    "flex h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl",
                    "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  )}
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  disabled={submitting}
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
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={submitting}
                className={cn(
                  "flex h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 font-mono text-sm tabular-nums backdrop-blur-xl",
                  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                Takvimde kapladığınız zaman bloğu (varsayılan 120 dk). Çakışma
                kontrolü bu süreye göre yapılır.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">
                Notlar
              </span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="İsteğe bağlı — örn. renk, teknik tercih…"
                disabled={submitting}
                className="min-h-[96px]"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}

            <Button
              type="button"
              className="w-full rounded-xl shadow-glass-inner"
              disabled={
                submitting ||
                services.length === 0 ||
                staff.length === 0 ||
                !staffId.trim()
              }
              onClick={() => void submit()}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Randevu oluştur"
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
