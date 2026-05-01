"use client";

import { useCallback, useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import type { StaffRow } from "@/app/staff/actions";
import { StaffManager } from "@/components/staff/staff-manager";
import { ServicesManager } from "@/components/services/services-manager";
import { cn } from "@/lib/utils";

type ServiceRow = {
  id: string;
  name: string;
  price: number | null;
  duration: number | null;
};

type Tab = "services" | "staff";

type Props = {
  initialTab: Tab;
  initialServices: ServiceRow[];
  initialStaff: StaffRow[];
};

export function ManagementWorkspace({
  initialTab,
  initialServices,
  initialStaff,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl: Tab =
    searchParams.get("tab") === "staff" ? "staff" : "services";

  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const navigateTab = useCallback(
    (next: Tab) => {
      setTab(next);
      const q = new URLSearchParams(searchParams.toString());
      if (next === "staff") q.set("tab", "staff");
      else q.delete("tab");
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <header className="glass-nav rounded-3xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Yönetim
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
            Salon ayarları
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Hizmet fiyatlarını ve uzman kadrosunu buradan yönetin; randevu
            akışı bu verilerle güncellenir.
          </p>

          <div
            className="mt-6 inline-flex rounded-2xl border border-[rgba(255,255,255,0.2)] bg-black/[0.03] p-1 dark:bg-white/[0.06]"
            role="tablist"
            aria-label="Yönetim sekmeleri"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "services"}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
                tab === "services"
                  ? "glass-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => navigateTab("services")}
            >
              Hizmetler
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "staff"}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
                tab === "staff"
                  ? "glass-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => navigateTab("staff")}
            >
              Uzmanlar
            </button>
          </div>
        </header>
      </div>

      {tab === "services" ? (
        <ServicesManager initialServices={initialServices} embedded />
      ) : (
        <StaffManager initialStaff={initialStaff} embedded />
      )}
    </div>
  );
}
