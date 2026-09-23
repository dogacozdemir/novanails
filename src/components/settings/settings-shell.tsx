"use client";

import { m } from "framer-motion";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

import type { StaffDirectoryEntry } from "@/app/settings/actions";
import type { StaffRow } from "@/app/staff/actions";
import { ServicesManager } from "@/components/services/services-manager";
import { StudioSeedPanel } from "@/components/settings/studio-seed-panel";
import { StaffTimeOffPanel } from "@/components/settings/staff-time-off-panel";
import { StaffManager } from "@/components/staff/staff-manager";
import { SETTINGS_TABS, type SettingsTab } from "@/lib/settings-tabs";
import { cn } from "@/lib/utils";

type ServiceRow = {
  id: string;
  name: string;
  price: number | null;
  duration: number | null;
};

/** Tek Ayarlar sayfası: hizmetler, uzmanlar, izin/tatil ve salon kurulumu (?tab=). */
export function SettingsShell(props: {
  initialTab: SettingsTab;
  services: ServiceRow[];
  staff: StaffRow[];
  staffDirectory: StaffDirectoryEntry[];
  directoryError?: string;
}) {
  const pathname = usePathname();
  const [tab, setTab] = useState<SettingsTab>(props.initialTab);

  const selectTab = useCallback(
    (next: SettingsTab) => {
      setTab(next);
      // Sunucu turu olmadan adresi güncelle (yenileme / paylaşım aynı sekmeyi açar).
      const url = next === "services" ? pathname : `${pathname}?tab=${next}`;
      window.history.replaceState(null, "", url);
    },
    [pathname]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <div
          className="relative flex shrink-0 rounded-2xl bg-black/[0.05] p-1 dark:bg-white/[0.08]"
          role="tablist"
          aria-label="Ayarlar bölümleri"
        >
          {SETTINGS_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => selectTab(id)}
              className={cn(
                "relative z-10 flex min-h-11 flex-1 touch-manipulation items-center justify-center rounded-xl px-2 font-sans text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                tab === id
                  ? "text-[var(--nova-charcoal)] dark:text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {tab === id ? (
                <m.div
                  layoutId="settings-tab-highlight"
                  className="absolute inset-0 rounded-xl bg-white/60 shadow-diffuse ring-1 ring-white/55 dark:bg-white/[0.12] dark:ring-white/15"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  style={{ zIndex: 0 }}
                />
              ) : null}
              <span className="relative z-[1] text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "services" ? (
        <ServicesManager initialServices={props.services} embedded />
      ) : tab === "staff" ? (
        <StaffManager initialStaff={props.staff} embedded />
      ) : (
        <div className="mx-auto w-full max-w-4xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:pb-16 lg:px-8">
          {tab === "timeoff" ? (
            <StaffTimeOffPanel
              initialStaff={props.staffDirectory}
              loadError={props.directoryError}
            />
          ) : (
            <StudioSeedPanel />
          )}
        </div>
      )}
    </div>
  );
}
