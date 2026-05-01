"use client";

import Pencil from "lucide-react/dist/esm/icons/pencil.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import { useMemo, useState } from "react";

import {
  createService,
  deleteService,
  listServices,
  updateService,
} from "@/app/services/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  /** Opsiyonel katalog — tam tutar/süre randevuda da seçilir */
  price: number | null;
  duration: number | null;
};

type Props = {
  initialServices: Row[];
  /** Salon ayarları sekmeli görünümünde üst başlığı gizler */
  embedded?: boolean;
};

function formatCatalogueRow(r: Row): string {
  const pricePart =
    r.price != null && !Number.isNaN(Number(r.price))
      ? `${Number(r.price).toLocaleString("tr-TR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} ₺`
      : "—";
  const durPart =
    r.duration != null && r.duration > 0 ? `${r.duration} dk` : "—";
  return `${pricePart} · ${durPart}`;
}

export function ServicesManager({
  initialServices,
  embedded = false,
}: Props) {
  const [rows, setRows] = useState<Row[]>(initialServices);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Row>>({});

  const reload = async () => {
    const next = await listServices();
    setRows(
      next.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price != null ? Number(s.price) : null,
        duration: s.duration != null ? Number(s.duration) : null,
      }))
    );
  };

  const parseNullableMoney = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const v = parseFloat(t.replace(",", "."));
    if (Number.isNaN(v) || v < 0) throw new Error("Geçerli fiyat girin.");
    return v;
  };

  const parseNullableDuration = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const v = parseInt(t, 10);
    if (Number.isNaN(v) || v <= 0) throw new Error("Geçerli süre girin.");
    return v;
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Hizmet adı girin.");
      return;
    }
    let priceVal: number | null = null;
    let durVal: number | null = null;
    try {
      priceVal = parseNullableMoney(price);
      durVal = parseNullableDuration(duration);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geçerli değer girin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createService({
        name: name.trim(),
        price: priceVal,
        duration: durVal,
      });
      setName("");
      setPrice("");
      setDuration("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setDraft({
      name: r.name,
      price: r.price,
      duration: r.duration,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = async (id: string) => {
    let priceVal: number | null = null;
    let durVal: number | null = null;
    try {
      priceVal =
        draft.price === undefined || draft.price === null
          ? null
          : Number(draft.price);
      if (
        draft.price !== undefined &&
        draft.price !== null &&
        (Number.isNaN(priceVal as number) || (priceVal as number) < 0)
      ) {
        throw new Error("Geçerli fiyat girin.");
      }
      durVal =
        draft.duration === undefined || draft.duration === null
          ? null
          : Number(draft.duration);
      if (
        draft.duration !== undefined &&
        draft.duration !== null &&
        (Number.isNaN(durVal as number) ||
          (durVal as number) <= 0)
      ) {
        throw new Error("Geçerli süre girin.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geçerli değerler girin.");
      return;
    }
    if (!draft.name?.trim()) {
      setError("Geçerli ad girin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateService(id, {
        name: draft.name!.trim(),
        price: priceVal,
        duration: durVal,
      });
      cancelEdit();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Güncellenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Bu hizmeti silmek istediğinize emin misiniz? Bağlı randevular varsa işlem reddedilir."
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteService(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [rows]
  );

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:pb-16 lg:px-8",
        embedded ? "pt-0" : "pt-6"
      )}
    >
      {!embedded ? (
        <header className="glass-nav rounded-3xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Yönetim
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
            Hizmetler
          </h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Hizmet adı zorunludur; fiyat ve süre opsiyonel katalog bilgisidir,
            kesin tutar randevu tamamlanırken girilir.
          </p>
        </header>
      ) : null}

      <section className="glass-surface-strong space-y-4 rounded-3xl p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Yeni hizmet
        </h2>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Ad
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Jel tırnak uzatma"
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Fiyat (₺, opsiyonel)
            </span>
            <Input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Boş bırakılabilir"
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Süre (dk, opsiyonel)
            </span>
            <Input
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Örn. 90"
              disabled={busy}
            />
          </div>
          <Button
            type="button"
            className="rounded-xl shadow-glass-inner sm:mt-5"
            disabled={busy}
            onClick={() => void handleCreate()}
          >
            <Plus className="mr-2 size-4" />
            Ekle
          </Button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="glass-surface overflow-hidden rounded-3xl">
        <div className="border-b border-[var(--glass-border)] px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Kayıtlı hizmetler
          </h2>
        </div>
        <ul className="divide-y divide-[var(--glass-border)]">
          {sorted.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              {editingId === r.id ? (
                <>
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <Input
                      value={draft.name ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, name: e.target.value }))
                      }
                      disabled={busy}
                    />
                    <Input
                      inputMode="decimal"
                      value={
                        draft.price === undefined || draft.price === null
                          ? ""
                          : String(draft.price)
                      }
                      onChange={(e) => {
                        const t = e.target.value.trim();
                        if (!t) {
                          setDraft((d) => ({
                            ...d,
                            price: null,
                          }));
                          return;
                        }
                        const v = parseFloat(t.replace(",", "."));
                        setDraft((d) => ({
                          ...d,
                          price: Number.isNaN(v) ? d.price : v,
                        }));
                      }}
                      placeholder="—"
                      disabled={busy}
                    />
                    <Input
                      inputMode="numeric"
                      value={
                        draft.duration === undefined ||
                        draft.duration === null
                          ? ""
                          : String(draft.duration)
                      }
                      onChange={(e) => {
                        const t = e.target.value.trim();
                        if (!t) {
                          setDraft((d) => ({
                            ...d,
                            duration: null,
                          }));
                          return;
                        }
                        const v = parseInt(t, 10);
                        setDraft((d) => ({
                          ...d,
                          duration: Number.isNaN(v) ? d.duration : v,
                        }));
                      }}
                      placeholder="—"
                      disabled={busy}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={busy}
                      onClick={cancelEdit}
                    >
                      Vazgeç
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl"
                      disabled={busy}
                      onClick={() => void saveEdit(r.id)}
                    >
                      Kaydet
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCatalogueRow(r)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-xl"
                      aria-label="Düzenle"
                      disabled={busy}
                      onClick={() => startEdit(r)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="rounded-xl"
                      aria-label="Sil"
                      disabled={busy}
                      onClick={() => void handleDelete(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
          {sorted.length === 0 ? (
            <li className="list-none">
              <EmptyState
                className="py-12"
                title="Henüz bir kayıt yok"
                description="Liste randevu akışında kullanılacak hizmetleri içerir; yeni hizmet ekleyerek başlayın."
              />
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
