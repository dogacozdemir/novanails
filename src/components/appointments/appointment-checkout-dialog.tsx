"use client";

import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";

import type { EnrichedAppointment, RecordPaymentPayload } from "@/app/appointments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NOVA_DIALOG_DESCRIPTION,
  NOVA_DIALOG_TITLE,
  NOVA_GLASS_DIALOG_OVERLAY_STACKED,
  NOVA_GLASS_DIALOG_PANEL_STACKED,
} from "@/lib/glass-dialog-classes";
import type { PaymentMethod } from "@/types/database";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: EnrichedAppointment | null;
  busy: boolean;
  restrictStaffWorkflow: boolean;
  onPayment: (payload: RecordPaymentPayload) => Promise<void>;
};

export function AppointmentCheckoutDialog({
  open,
  onOpenChange,
  appointment,
  busy,
  restrictStaffWorkflow,
  onPayment,
}: Props) {
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [actualDur, setActualDur] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !appointment) return;
    const catalogue = appointment.service?.price;
    if (restrictStaffWorkflow) {
      setPayAmount("");
    } else {
      setPayAmount(
        catalogue != null && !Number.isNaN(Number(catalogue))
          ? String(Number(catalogue))
          : ""
      );
    }
    setPayMethod("cash");
    setActualDur(String(Math.max(1, appointment.planned_duration ?? 120)));
    setPayError(null);
  }, [open, appointment, restrictStaffWorkflow]);

  const submitCheckout = async () => {
    if (!appointment) return;
    setPayError(null);
    const raw = payAmount.replace(",", ".").trim();
    const fp = parseFloat(raw);
    if (!Number.isFinite(fp) || fp <= 0) {
      setPayError("Alınan ücret zorunludur; geçerli bir tutar girin (TL).");
      return;
    }
    let actual: number | null | undefined;
    const durRaw = actualDur.trim();
    if (durRaw === "") {
      actual = Math.max(1, appointment.planned_duration ?? 120);
    } else {
      const n = parseInt(durRaw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        setPayError("Gerçekleşen süre pozitif bir tam sayı olmalıdır.");
        return;
      }
      actual = n;
    }
    try {
      await onPayment({
        final_price: fp,
        payment_method: payMethod,
        actual_duration: actual,
      });
      onOpenChange(false);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Kayıt yapılamadı.");
    }
  };

  if (!appointment) return null;

  const staffLimited = restrictStaffWorkflow;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={NOVA_GLASS_DIALOG_OVERLAY_STACKED} />
        <Dialog.Content
          className={NOVA_GLASS_DIALOG_PANEL_STACKED}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className={NOVA_DIALOG_TITLE}>İşlemi bitir</Dialog.Title>
          <Dialog.Description className={NOVA_DIALOG_DESCRIPTION}>
            {staffLimited ? (
              <>
                Ücret, ödeme yöntemi ve gerçekleşen süreyi girin; randevu
                tamamlanır.
              </>
            ) : (
              <>
                Tahsilatı kaydedin; randevu tamamlanır ve kasaya işlenir.
              </>
            )}
          </Dialog.Description>

          <div className="mt-6 flex flex-col gap-4">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Alınan ücret (TL) <span className="text-destructive">*</span>
              </label>
              <Input
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="örn. 950"
                disabled={busy}
                className="rounded-xl border-[var(--glass-border)] bg-[var(--glass-bg)]"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Ödeme yöntemi
              </label>
              <select
                className="flex h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl"
                value={payMethod}
                onChange={(e) =>
                  setPayMethod(e.target.value as PaymentMethod)
                }
                disabled={busy}
              >
                <option value="cash">Nakit</option>
                <option value="credit_card">Kredi kartı</option>
                <option value="iban">Havale / IBAN</option>
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
                {staffLimited ? (
                  <>
                    Planlanan süre: {appointment.planned_duration} dk (isterseniz
                    değiştirin).
                  </>
                ) : (
                  <>
                    Varsayılan: planlanan {appointment.planned_duration} dk —
                    düzenlenebilir.
                  </>
                )}
              </p>
            </div>
            {payError ? (
              <p className="text-sm text-destructive">{payError}</p>
            ) : null}

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
                onClick={() => void submitCheckout()}
              >
                {busy ? (
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
  );
}
