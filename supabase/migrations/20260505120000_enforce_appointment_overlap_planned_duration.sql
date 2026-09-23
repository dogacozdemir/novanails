-- Çakışma tetikleyicisi: yalnızca randevunun planned_duration değeri kullanılır
-- (katalog süresine bakılmaz); 0 veya NULL ise 120 dk varsayılır.
--
-- NOT: Bu dosya canlı veritabanında 2026-05-07'de uygulanmış (public._nova_schema_migrations
-- kaydı mevcut) ancak repoda eksikti. İçerik, 2026-09-23 tarihinde canlı şemadaki fonksiyon
-- tanımından birebir geri kazanılmıştır. Tekrar çalıştırılması güvenlidir (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.enforce_appointment_staff_overlap ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  new_start_ts timestamp WITHOUT TIME ZONE;
  new_end_ts timestamp WITHOUT TIME ZONE;
  new_dur integer;
  overlaps_other boolean;
BEGIN
  new_dur := GREATEST(1, COALESCE(NULLIF(NEW.planned_duration, 0), 120));

  new_start_ts := NEW.appointment_date + NEW.appointment_time;
  new_end_ts := new_start_ts + (new_dur || ' minutes')::interval;

  SELECT EXISTS (
    SELECT
      1
    FROM
      public.appointments AS a
    WHERE
      a.staff_id = NEW.staff_id
      AND a.appointment_date = NEW.appointment_date
      AND (a.status IS NULL OR a.status <> 'cancelled'::public.appointment_status)
      AND (TG_OP = 'INSERT'
        OR a.id IS DISTINCT FROM NEW.id)
      AND (NEW.appointment_date + a.appointment_time) < new_end_ts
      AND (
        NEW.appointment_date + a.appointment_time
        + (
          (GREATEST(1, COALESCE(NULLIF(a.planned_duration, 0), 120)) || ' minutes')::interval
        )
      ) > new_start_ts
  )
  INTO overlaps_other;

  IF overlaps_other THEN
    RAISE EXCEPTION 'Randevu zamanı başka bir randevu ile çakışıyor.';
  END IF;

  RETURN NEW;
END;
$$;
