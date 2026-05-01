import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import type { Metadata } from "next";

import { StudioSeedPanel } from "@/components/settings/studio-seed-panel";

export const metadata: Metadata = {
  title: "Ayarlar",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 pb-28 pt-6 sm:px-6 md:pb-16 lg:px-8">
      <header className="glass-nav rounded-3xl px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Nova Studio
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
          Ayarlar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          İlk kurulum ve gelecekte tema ile bildirim tercihleri.
        </p>
      </header>

      <StudioSeedPanel />

      <section className="glass-surface-strong rounded-3xl px-6 py-10 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner ring-1 ring-black/[0.06]">
          <Sparkles className="size-7" aria-hidden />
        </span>
        <p className="mt-6 font-heading text-lg font-semibold text-foreground">
          Yakında
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Bildirimler, tema ve profil ayarları için bu sayfa genişletilecek.
        </p>
      </section>
    </div>
  );
}
