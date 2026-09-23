"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import Palmtree from "lucide-react/dist/esm/icons/tree-palm.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import UserMinus from "lucide-react/dist/esm/icons/user-minus.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { manageStaffTimeOff } from "@/app/appointments/actions";
import type { StaffBrief } from "@/app/appointments/actions";
import type { StaffDirectoryEntry } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NOVA_DIALOG_DESCRIPTION,
  NOVA_DIALOG_TITLE,
  NOVA_GLASS_DIALOG_OVERLAY,
  NOVA_GLASS_DIALOG_PANEL,
} from "@/lib/glass-dialog-classes";
import { formatDateTRLong, istanbulDateISO } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { StaffTimeOffType } from "@/types/database";

type Props = {
  initialStaff: StaffDirectoryEntry[];
  loadError?: string;
};

export function StaffTimeOffPanel({ initialStaff, loadError }: Props) {
  const router = useRouter();
  const [staffRows, setStaffRows] = useState(initialStaff);

  useEffect(() => {
    setStaffRows(initialStaff);
  }, [initialStaff]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStaff, setDialogStaff] = useState<StaffBrief | null>(null);
  const [date, setDate] = useState(() => istanbulDateISO());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [offType, setOffType] = useState<StaffTimeOffType>("leave");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const todayISO = istanbulDateISO();

  const openForStaff = (s: StaffBrief) => {
    setDialogStaff(s);
    setDate(istanbulDateISO());
    setStart("09:00");
    setEnd("18:00");
    setOffType("leave");
    setReason("");
    setDialogOpen(true);
  };

  const resetDialogFields = () => {
    setDate(istanbulDateISO());
    setStart("09:00");
    setEnd("18:00");
    setOffType("leave");
    setReason("");
  };

  const submit = async () => {
    if (!dialogStaff) return;
    setBusy(true);
    try {
      await manageStaffTimeOff({
        action: "create",
        staff_id: dialogStaff.id,
        date,
        start_time: start,
        end_time: end,
        type: offType,
        reason: reason.trim() || null,
      });
      toast.success("İzin / tatil kaydedildi.");
      setDialogOpen(false);
      resetDialogFields();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kayıt eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const removeOff = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await manageStaffTimeOff({ action: "delete", id });
        toast.success("Kayıt silindi.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Silinemedi.");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  if (loadError) {
    return (
      <section className="glass-surface-strong rounded-3xl border border-destructive/25 px-6 py-6">
        <p className="text-sm text-destructive">{loadError}</p>
      </section>
    );
  }

  if (!staffRows.length) {
    return (
      <section className="glass-surface-strong rounded-3xl px-6 py-10 text-center">
        <p className="font-heading text-lg font-semibold text-foreground">
          Uzman bulunamadı
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Önce Uzmanlar sekmesinden uzman ekleyin veya Kurulum sekmesinden başlangıç uzmanlarını yükleyin.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Personel
          </p>
          <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">
            İzin ve tatiller
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Her uzman için izin veya salon tatili tanımlayın; kayıtlar randevu
            tahtasında görünür.
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {staffRows.map((s) => {
            const offs = s.time_off;
            return (
              <li
                key={s.id}
                className="glass-surface-strong rounded-3xl border border-[var(--glass-border)] px-5 py-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="size-3 shrink-0 rounded-full ring-2 ring-white/55 shadow-sm"
                      style={{ backgroundColor: s.color_code }}
                      aria-hidden
                    />
                    <p className="font-heading text-lg font-semibold text-[var(--nova-charcoal)]">
                      {s.name}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 shrink-0 rounded-xl shadow-diffuse"
                    onClick={() =>
                      openForStaff({
                        id: s.id,
                        name: s.name,
                        color_code: s.color_code,
                      })
                    }
                  >
                    <Plus className="mr-2 size-4" aria-hidden />
                    İzin / tatil tanımla
                  </Button>
                </div>

                <div className="mt-4 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
                  {offs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Bu uzman için kayıtlı izin veya tatil yok.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {offs.map((row) => {
                        const isPast = row.date < todayISO;
                        const TypeIcon =
                          row.type === "holiday" ? Palmtree : UserMinus;
                        return (
                          <li
                            key={row.id}
                            className={cn(
                              "flex flex-col gap-2 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                              isPast
                                ? "border-black/[0.06] bg-black/[0.03] dark:border-white/[0.08] dark:bg-white/[0.04]"
                                : "border-[var(--glass-border)] bg-[var(--glass-bg)]/80"
                            )}
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <TypeIcon
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                                <span className="font-sans text-sm font-semibold tabular-nums text-foreground">
                                  {formatDateTRLong(row.date)}
                                </span>
                                <span className="rounded-full bg-black/[0.06] px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.08]">
                                  {isPast ? "Geçmiş" : "Yaklaşan"}
                                </span>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold",
                                    row.type === "holiday"
                                      ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                                      : "bg-sky-500/15 text-sky-900 dark:text-sky-100"
                                  )}
                                >
                                  {row.type === "holiday" ? "Tatil" : "İzin"}
                                </span>
                              </div>
                              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                                {row.start_time} – {row.end_time}
                              </p>
                              {row.reason?.trim() ? (
                                <p className="text-xs leading-snug text-muted-foreground">
                                  {row.reason.trim()}
                                </p>
                              ) : null}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 rounded-xl text-destructive hover:bg-destructive/10"
                              disabled={busy}
                              aria-label="Kaydı sil"
                              onClick={() => void removeOff(row.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Dialog.Root
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) {
            setDialogStaff(null);
            resetDialogFields();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={NOVA_GLASS_DIALOG_OVERLAY} />
          <Dialog.Content
            className={NOVA_GLASS_DIALOG_PANEL}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className={NOVA_DIALOG_TITLE}>
                İzin / tatil
                {dialogStaff ? (
                  <span className="mt-1 block font-sans text-sm font-normal text-muted-foreground">
                    {dialogStaff.name}
                  </span>
                ) : null}
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
              Seçili uzmana ait bir tarih aralığında çalışma dışı zaman
              ekleyin.
            </Dialog.Description>

            <div className="mt-6 flex flex-col gap-4">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Tarih
                </span>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={busy}
                  className="h-11 rounded-xl"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Başlangıç
                  </span>
                  <Input
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    disabled={busy}
                    className="h-11 rounded-xl"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Bitiş
                  </span>
                  <Input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    disabled={busy}
                    className="h-11 rounded-xl"
                  />
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Tür
                </span>
                <select
                  className="flex h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm backdrop-blur-xl focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  value={offType}
                  onChange={(e) =>
                    setOffType(e.target.value as StaffTimeOffType)
                  }
                  disabled={busy}
                >
                  <option value="leave">İzin</option>
                  <option value="holiday">Tatil</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Not (isteğe bağlı)
                </span>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Açıklama"
                  disabled={busy}
                  className="h-11 rounded-xl"
                />
              </label>
              <Button
                type="button"
                className="h-11 w-full rounded-xl shadow-diffuse"
                disabled={busy || !dialogStaff}
                onClick={() => void submit()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-2 size-4" />
                    Kaydet
                  </>
                )}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
