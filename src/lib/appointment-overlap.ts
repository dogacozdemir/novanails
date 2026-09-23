import { parseTimeToMinutesFromMidnight } from "@/lib/time";
import type { AppointmentStatus } from "@/types/database";

/** Postgres tetikleyicisi ile aynı: geçerli plan süresi (dk), yoksa 120. */
export function effectivePlannedDurationMinutes(
  planned_duration: number | null | undefined,
  fallback = 120
): number {
  const p =
    planned_duration != null && Number.isFinite(Number(planned_duration))
      ? Number(planned_duration)
      : null;
  if (p != null && p > 0) {
    return Math.max(1, Math.round(p));
  }
  return Math.max(1, Math.round(fallback));
}

/** [start, end) dakika cinsinden; end > start varsayılır. */
export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export type ExistingAppointmentSlot = {
  appointment_time: string;
  durationMinutes: number;
  status?: AppointmentStatus | string | null;
};

/** İptal edilen satırlar ve varsa status='cancelled' yok sayılır (DB ile uyum). */
export function findStaffOverlapMinutes(params: {
  newStartMinutes: number;
  newDurationMinutes: number;
  existing: ExistingAppointmentSlot[];
}): boolean {
  const newDur = effectivePlannedDurationMinutes(
    params.newDurationMinutes,
    120
  );
  const newEnd = params.newStartMinutes + newDur;
  for (const row of params.existing) {
    if (row.status === "cancelled") continue;
    const exDur = effectivePlannedDurationMinutes(row.durationMinutes, 120);
    const exStart = parseTimeToMinutesFromMidnight(row.appointment_time);
    const exEnd = exStart + exDur;
    if (
      intervalsOverlap(
        params.newStartMinutes,
        newEnd,
        exStart,
        exEnd
      )
    ) {
      return true;
    }
  }
  return false;
}
