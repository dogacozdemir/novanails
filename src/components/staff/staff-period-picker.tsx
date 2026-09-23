"use client";

import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  STAFF_PERIOD_ALL,
  STAFF_PERIOD_PARAM,
  isValidMonthISO,
  type StaffPeriod,
} from "@/lib/staff-period";
import { cn } from "@/lib/utils";

type Props = {
  period: StaffPeriod;
  /** İstanbul takvimine göre bu ay (YYYY-MM) */
  currentMonthISO: string;
};

const segBase =
  "flex h-11 min-h-[44px] touch-manipulation items-center rounded-full px-4 font-sans text-sm font-medium transition-colors";
const segActive =
  "bg-white/72 text-[var(--nova-charcoal)] shadow-[0_2px_14px_-4px_rgba(0,0,0,0.12)] ring-1 ring-white/60 dark:bg-white/[0.14] dark:text-foreground dark:ring-white/12";
const segIdle =
  "text-muted-foreground hover:bg-white/10 dark:hover:bg-white/[0.06]";

/** Ay seçici + "Bu ay" + "Tüm zamanlar" — seçim URL'de (?ay=) tutulur. */
export function StaffPeriodPicker({ period, currentMonthISO }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const go = (value: string) => {
    startTransition(() => {
      router.push(`${pathname}?${STAFF_PERIOD_PARAM}=${value}`, {
        scroll: false,
      });
    });
  };

  const isAll = period.kind === "all";
  const isCurrent =
    period.kind === "month" && period.monthISO === currentMonthISO;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex items-center gap-1 rounded-full bg-black/[0.055] p-1 shadow-inner ring-1 ring-black/[0.04] dark:bg-white/[0.07] dark:ring-white/[0.08]"
        role="group"
        aria-label="Dönem"
      >
        <input
          type="month"
          value={period.kind === "month" ? period.monthISO : ""}
          onChange={(e) => {
            if (isValidMonthISO(e.target.value)) go(e.target.value);
          }}
          aria-label="Ay seçin"
          className={cn(
            segBase,
            "border-0 bg-transparent px-3 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            !isAll && !isCurrent ? segActive : segIdle
          )}
        />
        <button
          type="button"
          onClick={() => go(currentMonthISO)}
          className={cn(segBase, isCurrent ? segActive : segIdle)}
          aria-pressed={isCurrent}
        >
          Bu ay
        </button>
        <button
          type="button"
          onClick={() => go(STAFF_PERIOD_ALL)}
          className={cn(segBase, isAll ? segActive : segIdle)}
          aria-pressed={isAll}
        >
          Tüm zamanlar
        </button>
      </div>
      {pending ? (
        <Loader2
          className="size-4 animate-spin text-muted-foreground"
          aria-label="Yükleniyor"
        />
      ) : null}
    </div>
  );
}
