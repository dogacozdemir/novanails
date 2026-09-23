"use client";

import { m } from "framer-motion";
import { useState } from "react";

import type { StaffDirectoryEntry } from "@/app/settings/actions";
import { StudioSeedPanel } from "@/components/settings/studio-seed-panel";
import { StaffTimeOffPanel } from "@/components/settings/staff-time-off-panel";
import { cn } from "@/lib/utils";

type TabId = "setup" | "staff";

export function SettingsShell(props: {
  staffDirectory: StaffDirectoryEntry[];
  directoryError?: string;
}) {
  const [tab, setTab] = useState<TabId>("setup");

  return (
    <div className="flex flex-col gap-6">
      <div
        className="relative flex shrink-0 rounded-2xl bg-black/[0.05] p-1 dark:bg-white/[0.08]"
        role="tablist"
        aria-label="Ayarlar bölümleri"
      >
        {(
          [
            ["setup", "Kurulum"],
            ["staff", "Uzmanlar"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "relative z-10 flex min-h-11 flex-1 touch-manipulation items-center justify-center rounded-xl px-4 font-sans text-sm font-semibold transition-colors",
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
            <span className="relative z-[1]">{label}</span>
          </button>
        ))}
      </div>

      {tab === "setup" ? (
        <StudioSeedPanel />
      ) : (
        <StaffTimeOffPanel
          initialStaff={props.staffDirectory}
          loadError={props.directoryError}
        />
      )}
    </div>
  );
}
