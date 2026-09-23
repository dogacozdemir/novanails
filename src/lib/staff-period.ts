import { formatMonthTRLong, monthExpenseDateRange } from "@/lib/time";

/** Çalışanlar ekranı dönemi — randevu tarihine göre. */
export type StaffPeriod =
  | { kind: "month"; monthISO: string }
  | { kind: "all" };

/** URL parametresi: ?ay=2026-09 veya ?ay=tum */
export const STAFF_PERIOD_PARAM = "ay";
export const STAFF_PERIOD_ALL = "tum";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthISO(value: string): boolean {
  return MONTH_RE.test(value);
}

export function parseStaffPeriod(
  raw: string | string[] | undefined,
  fallbackMonthISO: string
): StaffPeriod {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === STAFF_PERIOD_ALL) return { kind: "all" };
  if (v && isValidMonthISO(v)) return { kind: "month", monthISO: v };
  return { kind: "month", monthISO: fallbackMonthISO };
}

export function staffPeriodToParam(period: StaffPeriod): string {
  return period.kind === "all" ? STAFF_PERIOD_ALL : period.monthISO;
}

export function staffPeriodLabel(period: StaffPeriod): string {
  return period.kind === "all"
    ? "Tüm zamanlar"
    : formatMonthTRLong(period.monthISO);
}

/** appointment_date filtresi için [start, end] (dahil); tüm zamanlar için null. */
export function staffPeriodDateRange(
  period: StaffPeriod
): { start: string; end: string } | null {
  if (period.kind === "all") return null;
  return monthExpenseDateRange(period.monthISO);
}
