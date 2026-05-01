"use client";

import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getSeedSnapshot,
  seedStudioDefaults,
  type SeedSnapshot,
} from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StudioSeedPanel() {
  const [snapshot, setSnapshot] = useState<SeedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSeedSnapshot();
      setSnapshot(s);
    } catch {
      setSnapshot(null);
      toast.error("Kurulum bilgisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needsAttention =
    snapshot &&
    (snapshot.missingDefaultStaff ||
      snapshot.missingDefaultServices ||
      snapshot.staffCount === 0 ||
      snapshot.servicesCount === 0);

  const runSeed = async () => {
    setBusy(true);
    try {
      const r = await seedStudioDefaults();
      toast.success(
        r.staffInserted || r.servicesInserted
          ? `Eklendi: ${r.staffInserted} uzman, ${r.servicesInserted} hizmet.`
          : "Tüm başlangıç verileri zaten mevcut."
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kayıt eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={cn(
        "rounded-3xl border px-6 py-6 transition-colors",
        needsAttention
          ? "border-primary/25 bg-primary/[0.06] shadow-inner ring-1 ring-primary/10"
          : "glass-surface-strong border-[var(--glass-border)]"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            İlk kurulum
          </p>
          <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">
            Başlangıç verileri
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Nova Uzman I ve II ile Jel Tırnak, Kalıcı Oje ve örnek hizmetler tek
            tıkla eklenir. Var olan kayıtlar korunur; eksik isimler tamamlanır.
          </p>
          {loading ? (
            <p className="mt-3 text-xs text-muted-foreground">Durum yükleniyor…</p>
          ) : snapshot ? (
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <li>
                Uzman:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {snapshot.staffCount}
                </span>
              </li>
              <li>
                Hizmet:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {snapshot.servicesCount}
                </span>
              </li>
              {needsAttention ? (
                <li className="font-medium text-amber-800 dark:text-amber-200">
                  Eksik varsayılan kayıt algılandı
                </li>
              ) : (
                <li className="text-emerald-700 dark:text-emerald-400">
                  Varsayılan set tamam
                </li>
              )}
            </ul>
          ) : null}
        </div>
        <Button
          type="button"
          className="shrink-0 rounded-xl shadow-glass-inner sm:mt-6"
          disabled={busy || loading}
          onClick={() => void runSeed()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <>
              <Sparkles className="mr-2 size-4 opacity-90" aria-hidden />
              Başlangıcı yükle
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
