"use client";

import Pencil from "lucide-react/dist/esm/icons/pencil.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import { useMemo, useState } from "react";

import {
  createStaff,
  deleteStaff,
  listStaff,
  updateStaff,
  type StaffRow,
} from "@/app/staff/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  initialStaff: StaffRow[];
  embedded?: boolean;
};

export function StaffManager({ initialStaff, embedded = false }: Props) {
  const [rows, setRows] = useState<StaffRow[]>(initialStaff);
  const [name, setName] = useState("");
  const [colorCode, setColorCode] = useState("#F5F1E9");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<StaffRow>>({});

  const reload = async () => {
    const next = await listStaff();
    setRows(next);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Uzman adı girin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createStaff({ name: name.trim(), color_code: colorCode });
      setName("");
      setColorCode("#F5F1E9");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (r: StaffRow) => {
    setEditingId(r.id);
    setDraft({ name: r.name, color_code: r.color_code });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = async (id: string) => {
    if (!draft.name?.trim()) {
      setError("Geçerli ad girin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateStaff(id, {
        name: draft.name!.trim(),
        color_code: draft.color_code ?? "#F5F1E9",
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
        "Bu uzmanı silmek istediğinize emin misiniz? Bağlı randevular varsa işlem reddedilir."
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteStaff(id);
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
            Uzmanlar
          </h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Takvimde her uzman için bir sütun oluşturulur; renk kodu tahta ve
            kartlarda kullanılır.
          </p>
        </header>
      ) : null}

      <section className="glass-surface-strong space-y-4 rounded-3xl p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Yeni uzman
        </h2>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Ad
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ayşe Y."
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Renk (hex)
            </span>
            <div className="flex gap-2">
              <input
                type="color"
                className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-[var(--glass-border)] bg-transparent p-1"
                value={
                  /^#[0-9A-Fa-f]{6}$/.test(colorCode) ? colorCode : "#F5F1E9"
                }
                onChange={(e) => setColorCode(e.target.value)}
                disabled={busy}
                aria-label="Renk seç"
              />
              <Input
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                placeholder="#F5F1E9"
                disabled={busy}
                className="font-mono text-sm"
              />
            </div>
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
            Kayıtlı uzmanlar
          </h2>
        </div>
        <ul className="divide-y divide-[var(--glass-border)]">
          {sorted.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {editingId === r.id ? (
                <>
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <Input
                      value={draft.name ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, name: e.target.value }))
                      }
                      disabled={busy}
                    />
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-[var(--glass-border)] bg-transparent p-1"
                        value={
                          /^#[0-9A-Fa-f]{6}$/.test(draft.color_code ?? "")
                            ? (draft.color_code as string)
                            : "#F5F1E9"
                        }
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            color_code: e.target.value,
                          }))
                        }
                        disabled={busy}
                        aria-label="Renk seç"
                      />
                      <Input
                        value={draft.color_code ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            color_code: e.target.value,
                          }))
                        }
                        disabled={busy}
                        className="font-mono text-sm"
                      />
                    </div>
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
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="size-10 shrink-0 rounded-2xl shadow-inner ring-1 ring-white/40"
                      style={{ backgroundColor: `${r.color_code}44` }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{r.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {r.color_code}
                      </p>
                    </div>
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
                description="Randevu tahtası uzman listesine göre sütun oluşturur; ilk uzmanı ekleyerek başlayın."
              />
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
