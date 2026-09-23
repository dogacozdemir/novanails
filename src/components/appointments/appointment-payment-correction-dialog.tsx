"use client";

import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  correctAppointmentPayment,
  type EnrichedAppointment,
} from "@/app/appointments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NOVA_DIALOG_DESCRIPTION,
  NOVA_DIALOG_TITLE,
  NOVA_GLASS_DIALOG_OVERLAY_STACKED,
  NOVA_GLASS_DIALOG_PANEL_STACKED,
} from "@/lib/glass-dialog-classes";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ORDER,
  isPaymentMethod,
  paymentMethodLabel,
} from "@/lib/payment-method-labels";
import type { PaymentMethod } from "@/types/database";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: EnrichedAppointment | null;
  /** Başarılı düzeltmeden sonra (tahta / liste yenileme) */
  onCorrected: () => void | Promise<void>;
};

function formatTL(n: number) {
  return `${n.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`;
}

/** Yönetici: tamamlanmış randevunun ödemesini düzeltir (geçmişe kaydedilir). */
export function AppointmentPaymentCorrectionDialog({
  open,
  onOpenChange,
  appointment,
  onCorrected,
}: Props) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [actualDur, setActualDur] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !appointment) return;
    setAmount(
      appointment.final_price != null ? String(appointment.final_price) : ""
    );
    setMethod(appointment.payment_method ?? "");
    setActualDur(
      appointment.actual_duration != null
        ? String(appointment.actual_duration)
        : ""
    );
    setReason("");
    setError(null);
  }, [open, appointment]);

  if (!appointment) return null;

  const submit = async () => {
    setError(null);
    const fp = parseFloat(amount.replace(",", ".").trim());
    if (!Number.isFinite(fp) || fp <= 0) {
      setError("Tutar zorunludur; geçerli bir tutar girin (TL).");
      return;
    }
    if (!isPaymentMethod(method)) {
      setError("Ödeme yöntemi seçin.");
      return;
    }
    let actual: number | null = null;
    const durRaw = actualDur.trim();
    if (durRaw !== "") {
      const n = parseInt(durRaw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        setError("Gerçekleşen süre pozitif bir tam sayı olmalıdır.");
        return;
      }
      actual = n;
    }

    setBusy(true);
    try {
      await correctAppointmentPayment(appointment.id, {
        final_price: fp,
        payment_method: method,
        actual_duration: actual,
        reason: reason.trim() || null,
      });
      toast.success("Ödeme düzeltildi.");
      await onCorrected();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ödeme düzeltilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className={NOVA_GLASS_DIALOG_OVERLAY_STACKED} />
        <Dialog.Content
          className={NOVA_GLASS_DIALOG_PANEL_STACKED}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className={NOVA_DIALOG_TITLE}>
            Ödemeyi düzelt
          </Dialog.Title>
          <Dialog.Description className={NOVA_DIALOG_DESCRIPTION}>
            Tahsilat kaydı ve randevu birlikte güncellenir; gelir, ilk
            kaydedildiği tarihte kalır. Düzeltme geçmişe işlenir.
          </Dialog.Description>

          <div className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5 text-xs text-muted-foreground">
            Mevcut:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {appointment.final_price != null
                ? formatTL(appointment.final_price)
                : "—"}
            </span>{" "}
            · {paymentMethodLabel(appointment.payment_method)}
            {appointment.actual_duration != null
              ? ` · ${appointment.actual_duration} dk`
              : ""}
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Doğru ücret (TL) <span className="text-destructive">*</span>
              </label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="örn. 950"
                disabled={busy}
                className="rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)]"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Ödeme yöntemi <span className="text-destructive">*</span>
              </label>
              <select
                className="flex h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl"
                value={method}
                onChange={(e) =>
                  setMethod(
                    isPaymentMethod(e.target.value) ? e.target.value : ""
                  )
                }
                disabled={busy}
              >
                <option value="">Seçin</option>
                {PAYMENT_METHOD_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Gerçekleşen süre (dk)
              </label>
              <Input
                inputMode="numeric"
                value={actualDur}
                onChange={(e) => setActualDur(e.target.value)}
                placeholder={String(appointment.planned_duration ?? 120)}
                disabled={busy}
                className="rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)] font-mono tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Boş bırakılırsa mevcut süre korunur.
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Düzeltme açıklaması
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="İsteğe bağlı — örn. yanlış tutar girilmişti"
                disabled={busy}
                className="min-h-[72px] rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)]"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl shadow-glass-inner"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Düzeltmeyi kaydet"
                )}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
