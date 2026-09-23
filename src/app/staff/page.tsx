import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getStaffOverview } from "@/app/staff/actions";
import { StaffPeriodPicker } from "@/components/staff/staff-period-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  STAFF_PERIOD_PARAM,
  parseStaffPeriod,
  staffPeriodLabel,
  staffPeriodToParam,
} from "@/lib/staff-period";
import { istanbulYearMonthISO } from "@/lib/time";

export const metadata: Metadata = {
  title: "Çalışanlar",
};

function formatMoney(n: number) {
  return `${n.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`;
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StaffPage({ searchParams }: Props) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/appointments");

  const sp = await searchParams;
  const currentMonthISO = istanbulYearMonthISO();
  const period = parseStaffPeriod(sp[STAFF_PERIOD_PARAM], currentMonthISO);
  const rows = await getStaffOverview(period);
  const periodParam = staffPeriodToParam(period);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 md:pb-16 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Nova Nail Studio
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--nova-charcoal)]">
            Çalışanlar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {staffPeriodLabel(period)} · randevu tarihine göre
          </p>
        </div>
        <StaffPeriodPicker period={period} currentMonthISO={currentMonthISO} />
      </header>

      {rows.length === 0 ? (
        <div className="liquid-glass-v2 shadow-diffuse rounded-[1.75rem]">
          <EmptyState
            novaAccent
            title="Henüz uzman eklenmedi"
            description="Ayarlar → Uzmanlar sekmesinden uzman ekleyebilirsiniz."
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/staff/${s.id}?${STAFF_PERIOD_PARAM}=${periodParam}`}
                className="liquid-glass-v2 shadow-diffuse group flex flex-col gap-4 rounded-[1.5rem] p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-[1px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-3 font-heading text-xl font-semibold text-[var(--nova-charcoal)] dark:text-foreground">
                    <span
                      className="size-3 shrink-0 rounded-full ring-2 ring-white/60 shadow-sm"
                      style={{ backgroundColor: s.color_code }}
                      aria-hidden
                    />
                    <span className="truncate">{s.name}</span>
                  </p>
                  <ChevronRight
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-black/[0.035] px-2 py-2.5 dark:bg-white/[0.05]">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tamamlanan
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums text-foreground">
                      {s.completedCount}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-black/[0.035] px-2 py-2.5 dark:bg-white/[0.05]">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tahsilat
                    </dt>
                    <dd className="mt-1 truncate font-semibold tabular-nums text-foreground">
                      {formatMoney(s.revenue)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-black/[0.035] px-2 py-2.5 dark:bg-white/[0.05]">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Yaklaşan
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums text-foreground">
                      {s.upcomingCount}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
