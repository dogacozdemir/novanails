import { intervalsOverlap } from "@/lib/appointment-overlap";
import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  parseTimeToMinutesFromMidnight,
} from "@/lib/time";

export type BusyIntervalMinutes = { start: number; end: number };

/** Salon operasyon saatleri — sabit 2 saatlik bloklar. */
export const FIXED_SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00"] as const;

/** İş günü içinde sabit slot başlangıçlarından çakışmasız olanlar (HH:mm). */
export function computeAvailableSlotStarts(params: {
  busyIntervals: BusyIntervalMinutes[];
  durationMinutes: number;
}): string[] {
  const dur = Math.max(15, Math.round(params.durationMinutes));
  const workStart = CALENDAR_DAY_START_HOUR * 60;
  const workEnd = CALENDAR_DAY_END_HOUR * 60;
  if (dur > workEnd - workStart) {
    return [];
  }

  const busy = [...params.busyIntervals].sort((a, b) => a.start - b.start);
  const slots: string[] = [];

  for (const slotHHmm of FIXED_SLOTS) {
    const t = parseTimeToMinutesFromMidnight(slotHHmm);
    const tEnd = t + dur;
    if (t < workStart || tEnd > workEnd) continue;

    let conflict = false;
    for (const b of busy) {
      if (intervalsOverlap(t, tEnd, b.start, b.end)) {
        conflict = true;
        break;
      }
    }
    if (!conflict) {
      slots.push(slotHHmm);
    }
  }

  return slots;
}
