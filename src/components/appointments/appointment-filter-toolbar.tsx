"use client";

import { m } from "framer-motion";
import CalendarRange from "lucide-react/dist/esm/icons/calendar-range.mjs";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import Filter from "lucide-react/dist/esm/icons/filter.mjs";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid.mjs";
import List from "lucide-react/dist/esm/icons/list.mjs";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.mjs";
import Palmtree from "lucide-react/dist/esm/icons/tree-palm.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import UserMinus from "lucide-react/dist/esm/icons/user-minus.mjs";
import Users from "lucide-react/dist/esm/icons/users.mjs";
import type { LucideIcon } from "lucide-react";
import { useCallback } from "react";

import type {
  StaffBrief,
  TimelineFilterStatus,
} from "@/app/appointments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FIXED_SLOTS } from "@/lib/compute-available-slots";
import { istanbulDateISO } from "@/lib/time";
import { cn } from "@/lib/utils";

export type AppointmentViewMode = "board" | "list";

const BAR_H = "h-11 min-h-[44px]";

const segTransition = {
  type: "spring" as const,
  stiffness: 380,
  damping: 28,
};

const popoverMotion =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 duration-300 ease-out";

/** Satır 1 — Kimlik / mod dengesi: yalnızca Tahta · Liste anahtarı */
export function AppointmentViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: AppointmentViewMode;
  onViewModeChange: (mode: AppointmentViewMode) => void;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full shrink-0 rounded-full border-t-[0.5px] border-l-[0.5px] border-white/35 bg-black/[0.055] p-1 shadow-inner ring-1 ring-black/[0.04] dark:border-white/15 dark:bg-white/[0.07] dark:ring-white/[0.08] sm:w-auto",
        "[backdrop-filter:blur(20px)_saturate(1.6)] [-webkit-backdrop-filter:blur(20px)_saturate(1.6)] max-md:[backdrop-filter:blur(12px)_saturate(1.6)] max-md:[-webkit-backdrop-filter:blur(12px)_saturate(1.6)]"
      )}
      role="tablist"
      aria-label="Görünüm"
    >
      {(["board", "list"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={viewMode === mode}
          onClick={() => onViewModeChange(mode)}
          className={cn(
            "relative z-10 flex flex-1 touch-manipulation items-center justify-center gap-2.5 rounded-full px-4 font-sans text-sm font-medium transition-colors duration-200 sm:min-w-[7rem] sm:flex-initial",
            BAR_H,
            viewMode === mode
              ? "text-[var(--nova-charcoal)] dark:text-foreground"
              : "text-muted-foreground hover:bg-white/10 dark:hover:bg-white/[0.06]"
          )}
        >
          {viewMode === mode ? (
            <m.div
              layoutId="appointments-view-highlight"
              className="absolute inset-0 rounded-full border-t-[0.5px] border-l-[0.5px] border-white/50 bg-white/72 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-white/60 dark:border-white/25 dark:bg-white/[0.14] dark:ring-white/12"
              transition={segTransition}
              style={{ zIndex: 0 }}
            />
          ) : null}
          <span className="relative z-[1] flex items-center gap-2.5">
            {mode === "board" ? (
              <LayoutGrid className="size-[1.05rem] shrink-0" aria-hidden />
            ) : (
              <List className="size-[1.05rem] shrink-0" aria-hidden />
            )}
            {mode === "board" ? "Tahta" : "Liste"}
          </span>
        </button>
      ))}
    </div>
  );
}

export type AppointmentFilterToolbarProps = {
  viewMode: AppointmentViewMode;
  dateRange: { start: string; end: string };
  onDateRangeChange: (r: { start: string; end: string }) => void;
  staffList: StaffBrief[];
  selectedStaffIds: string[];
  onSelectedStaffIdsChange: (ids: string[]) => void;
  selectedStatuses: TimelineFilterStatus[];
  onSelectedStatusesChange: (s: TimelineFilterStatus[]) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  filterPending?: boolean;
  showCancelled: boolean;
  onShowCancelledChange: (v: boolean) => void;
  /** Tahta: sabit saat dilimi görsel izolasyonu (10:00 … 18:00) */
  filterTimeSlot: string | null;
  onFilterTimeSlotChange: (slot: string | null) => void;
};

/** Durum filtresi: `value` = DB enum + synthetic (`TimelineFilterStatus`) */
const STATUS_OPTIONS: {
  value: TimelineFilterStatus;
  label: string;
}[] = [
  { value: "empty", label: "Boş" },
  { value: "waiting", label: "Randevu oluşturuldu" },
  { value: "message_sent", label: "Mesaj gönderildi" },
  { value: "confirmed", label: "Teyitlendi" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal" },
  { value: "holiday", label: "Tatil" },
  { value: "leave", label: "İzinli" },
];

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value];
}

/** Seçili filtre / görünüm vurgusu — üst-sol iç parıltı */
const pillSelectedInner =
  "absolute inset-0 rounded-full border-t-[0.5px] border-l-[0.5px] border-white/50 bg-white/72 shadow-[0_2px_14px_-4px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-white/60 dark:border-white/25 dark:bg-white/[0.14] dark:ring-white/12";

function FilterPillTrigger({
  active,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  count?: number;
}) {
  return (
    <PopoverTrigger asChild>
      <m.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={segTransition}
        className={cn(
          "relative flex touch-manipulation items-center gap-2.5 rounded-full px-4 font-sans text-sm font-medium transition-colors duration-200",
          BAR_H,
          active
            ? "text-[var(--nova-charcoal)] dark:text-foreground"
            : "text-muted-foreground hover:bg-white/10 dark:hover:bg-white/[0.06]"
        )}
      >
        {active ? <span className={pillSelectedInner} aria-hidden /> : null}
        <span className="relative z-[1] flex items-center gap-2.5">
          <Icon className="size-[1.05rem] shrink-0" aria-hidden />
          <span>
            {label}
            {count != null && count > 0 ? (
              <>
                {" · "}
                <span className="font-semibold tabular-nums text-foreground">
                  {count}
                </span>
              </>
            ) : null}
          </span>
        </span>
      </m.button>
    </PopoverTrigger>
  );
}

/** Tek satır komut çubuğu: tarih, filtreler, arama */
export function AppointmentFilterToolbar({
  viewMode,
  dateRange,
  onDateRangeChange,
  staffList,
  selectedStaffIds,
  onSelectedStaffIdsChange,
  selectedStatuses,
  onSelectedStatusesChange,
  searchQuery,
  onSearchQueryChange,
  filterPending = false,
  showCancelled,
  onShowCancelledChange,
  filterTimeSlot,
  onFilterTimeSlotChange,
}: AppointmentFilterToolbarProps) {
  const isBoard = viewMode === "board";
  const statusActive = selectedStatuses.length > 0 || showCancelled;
  const staffActive = selectedStaffIds.length > 0;
  const timeSlotActive = filterTimeSlot != null;
  const timeSlotLabel = filterTimeSlot ? `Saat: ${filterTimeSlot}` : "Saat";

  const onBoardDateChange = useCallback(
    (d: string) => {
      onDateRangeChange({ start: d, end: d });
    },
    [onDateRangeChange]
  );

  const dateTrackClass =
    "flex shrink-0 items-center rounded-full border-t-[0.5px] border-l-[0.5px] border-white/35 bg-black/[0.055] p-1 shadow-inner ring-1 ring-black/[0.04] transition-colors dark:border-white/15 dark:bg-white/[0.07] dark:ring-white/[0.08]";

  const boardDateInner = (
    <div
      className={cn(
        "flex items-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 backdrop-blur-xl transition-colors hover:bg-white/10 dark:hover:bg-white/[0.08]",
        BAR_H
      )}
    >
      <Input
        type="date"
        value={dateRange.start}
        onChange={(e) => onBoardDateChange(e.target.value)}
        className={cn(
          "h-full w-[max(9.5rem,11rem)] border-0 bg-transparent p-0 font-sans text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
        )}
        aria-label="Tarih"
      />
    </div>
  );

  const listDateInner = (
    <Popover>
      <PopoverTrigger asChild>
        <m.button
          type="button"
          whileTap={{ scale: 0.98 }}
          transition={segTransition}
          className={cn(
            "flex touch-manipulation items-center gap-2 rounded-full px-4 font-sans text-sm font-medium text-muted-foreground transition-colors hover:bg-white/10 dark:hover:bg-white/[0.06]",
            BAR_H
          )}
        >
          <CalendarRange className="size-[1.05rem] shrink-0" aria-hidden />
          <span className="tabular-nums">
            {dateRange.start === dateRange.end
              ? dateRange.start
              : `${dateRange.start} → ${dateRange.end}`}
          </span>
        </m.button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[min(100vw-2rem,22rem)] rounded-2xl border-[var(--glass-border)] bg-[var(--glass-bg-strong)] p-4 backdrop-blur-glass-strong",
          popoverMotion
        )}
        align="start"
      >
        <p className="mb-3 font-sans text-xs font-semibold text-muted-foreground">
          Tarih aralığı
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Başlangıç
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                onDateRangeChange({
                  ...dateRange,
                  start: e.target.value,
                })
              }
              className={cn(BAR_H, "rounded-xl px-3")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Bitiş
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                onDateRangeChange({
                  ...dateRange,
                  end: e.target.value,
                })
              }
              className={cn(BAR_H, "rounded-xl px-3")}
            />
          </label>
          <m.div whileTap={{ scale: 0.96 }} className="inline-flex w-fit">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(BAR_H, "rounded-full px-4")}
              onClick={() => {
                const t = istanbulDateISO();
                onDateRangeChange({ start: t, end: t });
              }}
            >
              Bugün
            </Button>
          </m.div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div
      className={cn(
        "liquid-glass-v2 shadow-diffuse relative rounded-2xl px-4 py-3 will-change-[backdrop-filter]",
        "[backdrop-filter:blur(25px)_saturate(1.6)] [-webkit-backdrop-filter:blur(25px)_saturate(1.6)] max-md:[backdrop-filter:blur(12px)_saturate(1.6)] max-md:[-webkit-backdrop-filter:blur(12px)_saturate(1.6)]"
      )}
    >
      {filterPending ? (
        <Loader2
          className="pointer-events-none absolute right-3 top-3 size-4 animate-spin text-primary/70"
          aria-hidden
        />
      ) : null}
      <span className="sr-only" aria-live="polite">
        {filterPending ? "Filtreler uygulanıyor" : ""}
      </span>

      <div
        className={cn(
          "flex w-full items-center justify-start gap-3",
          "max-sm:scrollbar-hide max-sm:overflow-x-auto max-sm:overscroll-x-contain",
          "sm:flex-nowrap sm:overflow-visible"
        )}
      >
        <div className={cn(dateTrackClass, "shrink-0")}>
          {isBoard ? boardDateInner : listDateInner}
        </div>

        {isBoard ? (
          <div className={cn(dateTrackClass, "shrink-0")}>
            <Popover>
              <FilterPillTrigger
                active={timeSlotActive}
                icon={Clock}
                label={timeSlotLabel}
              />
              <PopoverContent
                align="start"
                className={cn(
                  "w-[min(100vw-2rem,14rem)] rounded-2xl border-[var(--glass-border)] bg-[var(--glass-bg-strong)] p-2 backdrop-blur-glass-strong",
                  popoverMotion
                )}
              >
                <p className="px-2 pb-2 font-sans text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Saat dilimi
                </p>
                <div className="flex flex-col gap-1">
                  {FIXED_SLOTS.map((slot) => {
                    const active = filterTimeSlot === slot;
                    return (
                      <m.button
                        key={slot}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        transition={segTransition}
                        aria-pressed={active}
                        onClick={() =>
                          onFilterTimeSlotChange(active ? null : slot)
                        }
                        className={cn(
                          "relative flex w-full touch-manipulation items-center rounded-full px-4 text-left font-sans text-sm font-semibold tabular-nums transition-colors duration-200",
                          BAR_H,
                          active
                            ? "text-[var(--nova-charcoal)] dark:text-foreground"
                            : "text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                        )}
                      >
                        {active ? (
                          <span className={pillSelectedInner} aria-hidden />
                        ) : null}
                        <span className="relative z-[1]">{slot}</span>
                      </m.button>
                    );
                  })}
                </div>
                <p className="px-2 pt-2 font-sans text-[11px] text-muted-foreground">
                  Seçili saat, tahtada diğer randevuları soluklaştırır.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}

        <div className={cn(dateTrackClass, "shrink-0")}>
          <Popover>
            <FilterPillTrigger
              active={statusActive}
              icon={Filter}
              label="Durum"
              count={selectedStatuses.length}
            />
            <PopoverContent
              align="start"
              className={cn(
                "w-[min(100vw-2rem,20rem)] rounded-2xl border-[var(--glass-border)] bg-[var(--glass-bg-strong)] p-2 backdrop-blur-glass-strong",
                popoverMotion
              )}
            >
              <p className="px-2 pb-2 font-sans text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Durum (çoklu)
              </p>
              <div className="flex max-h-[min(50vh,22rem)] flex-col gap-1 overflow-y-auto">
                {STATUS_OPTIONS.map((opt) => {
                  const active = selectedStatuses.includes(opt.value);
                  const HI =
                    opt.value === "holiday"
                      ? Palmtree
                      : opt.value === "leave"
                        ? UserMinus
                        : null;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        onSelectedStatusesChange(
                          toggleInList(selectedStatuses, opt.value)
                        )
                      }
                      className={cn(
                        "flex w-full touch-manipulation items-center gap-2.5 rounded-xl px-3 text-left font-sans text-sm transition-colors",
                        BAR_H,
                        active
                          ? "bg-primary/15 font-semibold text-primary"
                          : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        )}
                      >
                        {active ? "✓" : ""}
                      </span>
                      {HI ? (
                        <HI className="size-4 shrink-0 opacity-80" />
                      ) : null}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="px-2 pt-2 font-sans text-[11px] leading-snug text-muted-foreground">
                Özel durum seçtiyseniz yalnızca seçtikleriniz uygulanır.
              </p>
              <div className="mt-2 border-t border-white/10 pt-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showCancelled}
                  onClick={() => onShowCancelledChange(!showCancelled)}
                  className="flex w-full touch-manipulation items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <span className="font-sans text-sm font-medium text-foreground">
                    İptal Edilenleri De Göster
                  </span>
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                      showCancelled ? "bg-primary" : "bg-black/[0.12] dark:bg-white/15"
                    )}
                    aria-hidden
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-5 rounded-full bg-white shadow-sm ring-1 ring-black/[0.06] transition-transform duration-200",
                        showCancelled ? "translate-x-[1.35rem]" : "translate-x-0.5"
                      )}
                    />
                  </span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className={cn(dateTrackClass, "shrink-0")}>
          <Popover>
            <FilterPillTrigger
              active={staffActive}
              icon={Users}
              label="Uzman"
              count={selectedStaffIds.length}
            />
            <PopoverContent
              align="start"
              className={cn(
                "w-[min(100vw-2rem,20rem)] rounded-2xl border-[var(--glass-border)] bg-[var(--glass-bg-strong)] p-2 backdrop-blur-glass-strong",
                popoverMotion
              )}
            >
              <p className="px-2 pb-2 font-sans text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Uzman (çoklu)
              </p>
              <div className="flex max-h-[min(50vh,22rem)] flex-col gap-1 overflow-y-auto">
                {staffList.map((s) => {
                  const active = selectedStaffIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        onSelectedStaffIdsChange(
                          toggleInList(selectedStaffIds, s.id)
                        )
                      }
                      className={cn(
                        "flex w-full touch-manipulation items-center gap-2.5 rounded-xl px-3 text-left font-sans text-sm transition-colors",
                        BAR_H,
                        active
                          ? "bg-primary/15 font-semibold text-primary"
                          : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full ring-2 ring-white/50"
                        style={{ backgroundColor: s.color_code }}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        )}
                      >
                        {active ? "✓" : ""}
                      </span>
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="px-2 pt-2 font-sans text-[11px] text-muted-foreground">
                Seçim yoksa tüm uzmanlar.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        <div className="ml-auto w-full min-w-[12rem] shrink-0 max-sm:min-w-[11rem] sm:max-w-[240px]">
          <label
            className={cn(
              "relative block w-full rounded-full transition-[box-shadow,ring-offset-color] duration-200",
              "focus-within:ring-2 focus-within:ring-primary/25 focus-within:ring-offset-2 focus-within:ring-offset-[var(--background)]",
              "dark:focus-within:ring-[#F59E0B]/30"
            )}
          >
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-[1.05rem] -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Müşteri ara..."
              className={cn(
                BAR_H,
                "w-full rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] py-0 pl-10 pr-4 font-sans text-sm font-medium leading-none shadow-none backdrop-blur-xl",
                "placeholder:font-medium placeholder:text-muted-foreground/75",
                "transition-colors hover:bg-white/10 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 dark:hover:bg-white/[0.08]"
              )}
              aria-label="Müşteri ara"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
