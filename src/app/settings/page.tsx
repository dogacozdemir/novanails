import type { Metadata } from "next";

import { getStaffDirectoryWithTimeOff } from "@/app/settings/actions";
import { SettingsShell } from "@/components/settings/settings-shell";

export const metadata: Metadata = {
  title: "Ayarlar",
};

export default async function SettingsPage() {
  const directory = await getStaffDirectoryWithTimeOff();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-28 pt-6 sm:px-6 md:pb-16 lg:px-8">
      <header className="glass-nav rounded-3xl px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Nova Studio
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
          Ayarlar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Salon kurulumu, uzmanlar ve ileride tema ile bildirim tercihleri.
        </p>
      </header>

      <SettingsShell
        staffDirectory={directory.staff}
        directoryError={directory.error}
      />
    </div>
  );
}
