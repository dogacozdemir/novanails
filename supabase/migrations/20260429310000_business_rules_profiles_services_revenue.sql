-- Rol sistemi, hizmet opsiyonel alanları, randevu süre/fiyat/ödeme, revenue sync alanı.

-- -----------------------------------------------------------------------------
-- Enumlar
-- -----------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('admin', 'staff');

COMMENT ON TYPE public.user_role IS 'Uygulama içi rol (profiles.role)';

CREATE TYPE public.payment_method AS ENUM ('cash', 'credit_card', 'iban');

COMMENT ON TYPE public.payment_method IS 'Ödeme yöntemi — appointments.revenue_entries ile uyumlu';

-- -----------------------------------------------------------------------------
-- profiles — auth.users ile eşleşir
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'staff'::public.user_role,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Kimlik doğrulayan kullanıcıya bağlı rol ve meta';

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access profiles" ON public.profiles FOR ALL TO authenticated USING (TRUE)
WITH
  CHECK (TRUE);

-- Mevcut kullanıcıları yükle: en eski = admin, diğerleri staff (tek kullanıcı varsa admin)
INSERT INTO public.profiles (id, role)
SELECT
  au.id,
  CASE
    WHEN ROW_NUMBER() OVER (
      ORDER BY
        au.created_at ASC NULLS LAST,
        au.id ASC
      ) = 1 THEN 'admin'::public.user_role
    ELSE 'staff'::public.user_role
  END
FROM
  auth.users au
ON CONFLICT (id) DO NOTHING;
-- Yeni kayıtlar için varsayılan staff profili (Supabase ortamında auth.users için süper kullanıcı gerekir)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'staff'::public.user_role)
  ON CONFLICT (id)
    DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;

CREATE TRIGGER on_auth_user_created_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile ();

-- -----------------------------------------------------------------------------
-- services — price ve duration opsiyonel (randevu anında planlama)
-- -----------------------------------------------------------------------------
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_price_check;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_duration_check;

ALTER TABLE public.services
  ALTER COLUMN price DROP NOT NULL;

ALTER TABLE public.services
  ALTER COLUMN duration DROP NOT NULL;

ALTER TABLE public.services ADD CONSTRAINT services_price_check CHECK (
  price IS NULL
  OR price >= 0
);

ALTER TABLE public.services ADD CONSTRAINT services_duration_check CHECK (
  duration IS NULL
  OR duration > 0
);

COMMENT ON COLUMN public.services.price IS 'Opsiyonel katalog fiyatı; gerçek tutar randevuda belirlenebilir.';
COMMENT ON COLUMN public.services.duration IS 'Opsiyonel katalog süresi (dk); randevuda planned_duration kullanılır';

-- -----------------------------------------------------------------------------
-- appointments — planlanan/gerçek süre, kapanış fiyatı, ödeme, personel notu
-- -----------------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN planned_duration integer NOT NULL DEFAULT 120 CHECK (planned_duration > 0),
  ADD COLUMN actual_duration integer CHECK (
    actual_duration IS NULL
    OR actual_duration > 0
  ),
  ADD COLUMN final_price numeric(12, 2) CHECK (
    final_price IS NULL
    OR final_price >= 0
  ),
  ADD COLUMN payment_method public.payment_method NULL,
  ADD COLUMN staff_notes text NULL;

COMMENT ON COLUMN public.appointments.planned_duration IS 'Randevu planında blok süresi (dk); varsayılan 120';
COMMENT ON COLUMN public.appointments.actual_duration IS 'İşlem bitince girilen gerçek süre (dk)';
COMMENT ON COLUMN public.appointments.final_price IS 'Ödeme alınırken girilen gerçek tutar';
COMMENT ON COLUMN public.appointments.payment_method IS 'Tamamlamada seçilen ödeme kanalı';
COMMENT ON COLUMN public.appointments.staff_notes IS 'Personelin randevu sırasında girdiği not';

COMMENT ON COLUMN public.appointments.notes IS 'Müşteri/randevu kaydı sırasında girilen genel not (ön yüz)';

UPDATE public.appointments a
SET
  planned_duration = GREATEST(
    1,
    COALESCE(
(
      SELECT
        s.duration FROM public.services s
      WHERE
        s.id = a.service_id),
120));

-- -----------------------------------------------------------------------------
-- revenue_entries — ödeme yöntemi kopyası
-- -----------------------------------------------------------------------------
ALTER TABLE public.revenue_entries
  ADD COLUMN payment_method public.payment_method NULL;

COMMENT ON COLUMN public.revenue_entries.payment_method IS 'Randevu tamamlanırken appointments.payment_method ile senkron';

-- -----------------------------------------------------------------------------
-- Çakışma triggerı — planned_duration öncelikli
-- -----------------------------------------------------------------------------
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
  new_dur := COALESCE(
    NEW.planned_duration,
(
      SELECT
        s.duration FROM public.services s
      WHERE
        s.id = NEW.service_id),
120);

  IF new_dur IS NULL OR new_dur < 1 THEN
    new_dur := 120;
  END IF;

  new_start_ts := NEW.appointment_date + NEW.appointment_time;
  new_end_ts := new_start_ts + (new_dur || ' minutes')::interval;

  SELECT
    EXISTS (
      SELECT
        1
      FROM
        public.appointments a
        LEFT JOIN public.services s ON s.id = a.service_id
      WHERE
        a.staff_id = NEW.staff_id
        AND a.appointment_date = NEW.appointment_date
        AND a.status <> 'cancelled'::public.appointment_status
        AND (TG_OP = 'INSERT'
          OR a.id IS DISTINCT FROM NEW.id)
        AND (NEW.appointment_date + a.appointment_time) < new_end_ts
        AND (NEW.appointment_date + a.appointment_time + (
          COALESCE(a.planned_duration, s.duration, 120) || ' minutes')::interval) > new_start_ts)
    INTO overlaps_other;

  IF overlaps_other THEN
    RAISE EXCEPTION 'Randevu zamanı başka bir randevu ile çakışıyor.';
  END IF;

  RETURN NEW;
END;
$$;
