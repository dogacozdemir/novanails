/** Randevu süre çakışması — sunucu aksiyonu ve PostgreSQL tetikleyicisi ile uyumlu */
export const APPOINTMENT_OVERLAP_ERROR =
  "Randevu zamanı başka bir randevu ile çakışıyor.";

/** Partial unique index (cancelled hariç) ihlali — Postgres 23505 */
export const APPOINTMENT_ACTIVE_SLOT_UNIQUE_ERROR =
  "Bu uzman için bu saatte halihazırda AKTİF bir randevu bulunuyor. Lütfen farklı bir saat seçin.";
