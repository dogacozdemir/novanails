import { parseTimeToMinutesFromMidnight } from "@/lib/time";

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
};

/** İptal edilen randevular zaman çizelgesinde yer kaplamaz. */
export function findStaffOverlapMinutes(params: {
  newStartMinutes: number;
  newDurationMinutes: number;
  existing: ExistingAppointmentSlot[];
}): boolean {
  const newEnd = params.newStartMinutes + Math.max(1, params.newDurationMinutes);
  for (const row of params.existing) {
    const exStart = parseTimeToMinutesFromMidnight(row.appointment_time);
    const exEnd = exStart + Math.max(1, row.durationMinutes);
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
