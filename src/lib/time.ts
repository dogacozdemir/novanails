import type { AppointmentStatus } from "@/types/database";

/** Randevu saatini HH:mm biçimine indirger (DB'den gelen time string için). */
export function normalizeDisplayTime(raw: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!match) return raw.trim().slice(0, 5);
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

/** Gece yarısından itibaren dakika (HH:mm veya HH:mm:ss). */
export function parseTimeToMinutesFromMidnight(raw: string): number {
  const n = normalizeDisplayTime(raw);
  const [h, m] = n.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Takvim sütunu dikey ekseni [08:00, 21:00) — Apple takvim benzeri iş günü şeridi */
export const CALENDAR_DAY_START_HOUR = 8;
export const CALENDAR_DAY_END_HOUR = 21;

const CALENDAR_START_MIN = CALENDAR_DAY_START_HOUR * 60;
const CALENDAR_END_MIN = CALENDAR_DAY_END_HOUR * 60;

export const CALENDAR_TRACK_MINUTES = CALENDAR_END_MIN - CALENDAR_START_MIN;

/** Şerit üzerinde üst konum % (randevu kutusu top). */
export function appointmentStartPercent(rawTime: string): number {
  const m = parseTimeToMinutesFromMidnight(rawTime);
  const clamped = Math.max(
    CALENDAR_START_MIN,
    Math.min(m, CALENDAR_END_MIN - 1)
  );
  return ((clamped - CALENDAR_START_MIN) / CALENDAR_TRACK_MINUTES) * 100;
}

/** Hizmet süresine göre kutu yüksekliği % (track içinde). */
export function appointmentDurationPercent(durationMin: number): number {
  const d = Math.max(15, durationMin);
  return Math.min((d / CALENDAR_TRACK_MINUTES) * 100, 100);
}

/**
 * Takvimde blok yüksekliği ve kart alt satırı için süre (dk):
 * tamamlanmış randevuda gerçek süre varsa plan yerine o kullanılır.
 */
export function calendarDisplayDurationMinutes(params: {
  status: AppointmentStatus;
  planned_duration: number | null | undefined;
  actual_duration: number | null | undefined;
  serviceDuration: number | null | undefined;
}): number {
  const plannedFallback =
    params.planned_duration != null && params.planned_duration > 0
      ? params.planned_duration
      : params.serviceDuration != null && params.serviceDuration > 0
        ? params.serviceDuration
        : 120;
  if (
    params.status === "completed" &&
    params.actual_duration != null &&
    params.actual_duration > 0
  ) {
    return Math.round(params.actual_duration);
  }
  return plannedFallback;
}

export function calendarHourMarkers(): number[] {
  const hours: number[] = [];
  for (let h = CALENDAR_DAY_START_HOUR; h < CALENDAR_DAY_END_HOUR; h += 1) {
    hours.push(h);
  }
  return hours;
}

/** Takvim saat işaretleri — sabit dizi (render başına yeniden hesaplanmaz). */
export const CALENDAR_HOUR_MARKERS = calendarHourMarkers();

/**
 * Şerit üzerindeki dikey tıklama konumundan HH:mm (iş günü içinde, varsayılan 5 dk yuvarlama).
 */
export function trackPercentToRoundedTime(
  percentY: number,
  snapMinutes = 5
): string {
  const clamped = Math.max(0, Math.min(100, percentY));
  let minutes =
    CALENDAR_START_MIN + (clamped / 100) * CALENDAR_TRACK_MINUTES;
  if (snapMinutes > 0) {
    minutes = Math.round(minutes / snapMinutes) * snapMinutes;
  }
  minutes = Math.max(
    CALENDAR_START_MIN,
    Math.min(CALENDAR_END_MIN - 1, minutes)
  );
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Yerel takvim günü YYYY-MM-DD (timezone kayması olmadan). */
export function localDateISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Örn. 29 Nisan 2026 — liste başlıkları için */
export function formatDateTRLong(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

/** İstanbul saati ile bugünün tarihi YYYY-MM-DD */
export function istanbulDateISO(d = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
  }).format(d);
}

/** İstanbul ayı YYYY-MM */
export function istanbulYearMonthISO(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

/** Ayın ilk ve son günü YYYY-MM-DD (yerel hesap, expense_date ile uyumlu) */
export function monthExpenseDateRange(monthISO: string) {
  const [y, m] = monthISO.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

/**
 * Bir önceki takvim ayı YYYY-MM (gider/gelir karşılaştırması için).
 */
export function previousMonthISO(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  if (m <= 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * `revenue_entries.recorded_at` için [başlangıç, son) UTC ISO aralığı.
 * Takvim ayı Europe/Istanbul ile uyumlu (sabit UTC+3 — Türkiye yaz/kış saati yok).
 */
export function monthRecordedRangeUtc(monthISO: string) {
  const [y, m] = monthISO.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startIso = new Date(`${y}-${pad(m)}-01T00:00:00+03:00`).toISOString();
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const endIso = new Date(`${ny}-${pad(nm)}-01T00:00:00+03:00`).toISOString();
  return { startIso, endIso };
}
