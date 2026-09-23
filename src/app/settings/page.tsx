import type { Metadata } from "next";

import { listServices } from "@/app/services/actions";
import { getStaffDirectoryWithTimeOff } from "@/app/settings/actions";
import { listStaff } from "@/app/staff/actions";
import { SettingsShell } from "@/components/settings/settings-shell";
import { parseSettingsTab } from "@/lib/settings-tabs";

export const metadata: Metadata = {
  title: "Ayarlar",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const sp = await searchParams;
  const [services, staff, directory] = await Promise.all([
    listServices(),
    listStaff(),
    getStaffDirectoryWithTimeOff(),
  ]);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="glass-nav rounded-3xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Nova Studio
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
            Ayarlar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hizmetler, uzman kadrosu, izin / tatil kayıtları ve salon kurulumu.
          </p>
        </header>
      </div>

      <SettingsShell
        initialTab={parseSettingsTab(sp.tab)}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          price: s.price != null ? Number(s.price) : null,
          duration: s.duration != null ? Number(s.duration) : null,
        }))}
        staff={staff}
        staffDirectory={directory.staff}
        directoryError={directory.error}
      />
    </div>
  );
}
