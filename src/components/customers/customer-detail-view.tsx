"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import Link from "next/link";
import { useState } from "react";

import type {
  CustomerRow,
  HistoryAppointment,
} from "@/app/customers/actions";
import { updateCustomerProfileNotes } from "@/app/customers/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTRLong, normalizeDisplayTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types/database";

function statusLabel(s: AppointmentStatus) {
  switch (s) {
    case "waiting":
      return "Bekliyor";
    case "message_sent":
      return "Mesaj gönderildi";
    case "confirmed":
      return "Onaylı";
    case "cancelled":
      return "İptal";
    case "completed":
      return "Tamamlandı";
    default:
      return s;
  }
}

type Props = {
  customer: CustomerRow;
  appointments: HistoryAppointment[];
  totalPaid: number;
  /** Gelir / ödenen tutarlar gizlenir (staff rolü). */
  financeHidden?: boolean;
};

export function CustomerDetailView({
  customer,
  appointments,
  totalPaid,
  financeHidden = false,
}: Props) {
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await updateCustomerProfileNotes(customer.id, notes.trim() || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Müşterilere dön
      </Link>

      <header className="liquid-glass-v2 shadow-diffuse rounded-[1.75rem] px-5 py-6 sm:px-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
          {customer.name} {customer.surname}
        </h1>
        {customer.phone ? (
          <p className="mt-1 text-sm text-muted-foreground">{customer.phone}</p>
        ) : null}
      </header>

      <section className="liquid-glass-v2 shadow-diffuse space-y-3 rounded-[1.75rem] p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Müşteriye özel kalıcı not
        </h2>
        <p className="text-xs text-muted-foreground">
          Alerji, tercih ve bakım notları burada saklanır; randevu kartlarından
          ayrıdır.
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Örn. soğuk alerji, kısa tırnak tercihi…"
          className="min-h-[120px]"
        />
        <Button
          type="button"
          className="rounded-xl shadow-glass-inner"
          disabled={saving}
          onClick={() => void saveNotes()}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Notu kaydet"
          )}
        </Button>
      </section>

      <section className="liquid-glass-v2 shadow-diffuse overflow-hidden rounded-[1.75rem]">
          <div
            className={cn(
              "flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.055] px-6 py-5 dark:border-white/[0.08]",
              financeHidden && "flex-col items-start sm:flex-row sm:items-end"
            )}
          >
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Geçmiş randevular
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {financeHidden
                ? "Yalnızca sizin gerçekleştirdiğiniz randevular listelenir."
                : "Ödenen tutarlar gelir kaydıyla eşleşir (tamamlanan randevular). Randevu notları yalnızca ilgili randevuya özeldir; müşteri kalıcı notundan farklıdır."}
            </p>
          </div>
          {!financeHidden ? (
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Toplam ödenen
            </p>
            <p className="font-heading text-2xl font-semibold text-foreground">
              {totalPaid.toLocaleString("tr-TR", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{" "}
              ₺
            </p>
          </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/[0.055] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-white/[0.08]">
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Saat</th>
                <th className="px-4 py-3">Hizmet</th>
                <th className="px-4 py-3">Uzman</th>
                <th className="px-4 py-3">Durum</th>
                <th className="min-w-[140px] px-4 py-3">Randevu notu</th>
                <th className="px-4 py-3 text-right">
                  {financeHidden ? "---" : "Ücret"}
                </th>
              </tr>
            </thead>
            {appointments.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      className="py-12"
                      title="Henüz bir kayıt yok"
                      description="Bu müşteri için geçmiş randevu kaydı bulunmuyor."
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-black/[0.055] dark:divide-white/[0.07]">
                {appointments.map((a) => (
                  <tr key={a.id} className="bg-transparent">
                    <td className="whitespace-nowrap px-4 py-3 text-foreground">
                      {formatDateTRLong(a.appointment_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                      {normalizeDisplayTime(a.appointment_time)}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3">
                      {a.service_name}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-muted-foreground">
                      {a.staff_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {statusLabel(a.status)}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-4 py-3 align-top">
                      {a.appointment_notes?.trim() ? (
                        <span
                          className="line-clamp-3 text-xs leading-relaxed text-muted-foreground"
                          title={a.appointment_notes.trim()}
                        >
                          {a.appointment_notes.trim()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/70">
                          —
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-muted-foreground">
                      {financeHidden ? (
                        "---"
                      ) : a.paid_amount != null ? (
                        <span className="font-medium text-foreground">
                          {a.paid_amount.toLocaleString("tr-TR", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}{" "}
                          ₺
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {a.service_price.toLocaleString("tr-TR", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}{" "}
                          ₺{" "}
                          <span className="block text-[10px] font-normal">
                            (ödeme yok)
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
