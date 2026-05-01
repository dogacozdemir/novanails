-- Uzman başına aynı gün süre çakışması engeli (trigger).
-- İptal edilen randevular zaman çizelgesinde sayılmaz.

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
  SELECT duration INTO new_dur
  FROM public.services
  WHERE id = NEW.service_id;

  IF new_dur IS NULL THEN
    RAISE EXCEPTION 'Hizmet bulunamadı.';
  END IF;

  new_start_ts := NEW.appointment_date + NEW.appointment_time;
  new_end_ts := new_start_ts + (new_dur || ' minutes')::interval;

  SELECT EXISTS (
    SELECT
      1
    FROM
      public.appointments a
      INNER JOIN public.services s ON s.id = a.service_id
    WHERE
      a.staff_id = NEW.staff_id
      AND a.appointment_date = NEW.appointment_date
      AND a.status <> 'cancelled'::public.appointment_status
      AND (TG_OP = 'INSERT'
        OR a.id IS DISTINCT FROM NEW.id)
      AND (NEW.appointment_date + a.appointment_time) < new_end_ts
      AND (NEW.appointment_date + a.appointment_time + (s.duration || ' minutes')::interval) > new_start_ts
  )
  INTO overlaps_other;

  IF overlaps_other THEN
    RAISE EXCEPTION 'Randevu zamanı başka bir randevu ile çakışıyor.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_appointment_staff_overlap () IS 'Aynı uzman/gün süre aralığı çakışmasını engeller (iptaller hariç).';

DROP TRIGGER IF EXISTS appointments_staff_overlap_check ON public.appointments;

CREATE TRIGGER appointments_staff_overlap_check
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_appointment_staff_overlap ();
