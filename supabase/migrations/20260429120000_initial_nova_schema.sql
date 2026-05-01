-- Nova Nail Studio — çekirdek şema (PostgreSQL / Supabase)
-- SQL Editor veya: supabase db push / migration pipeline ile çalıştırın.

-- -----------------------------------------------------------------------------
-- Enum: randevu durumu
-- -----------------------------------------------------------------------------
CREATE TYPE public.appointment_status AS ENUM (
  'waiting',
  'confirmed',
  'cancelled',
  'completed'
);

COMMENT ON TYPE public.appointment_status IS 'Randevu yaşam döngüsü';

-- -----------------------------------------------------------------------------
-- Tablolar
-- -----------------------------------------------------------------------------
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  surname text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customers IS 'Müşteri kayıtları';

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  duration integer NOT NULL CHECK (duration > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.services IS 'Hizmetler — panelden CRUD (RLS: authenticated)';
COMMENT ON COLUMN public.services.duration IS 'Süre (dakika)';

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  color_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.staff IS 'Uzmanlar — takvim renkleri için color_code (ör. #F5F1E9)';
COMMENT ON COLUMN public.staff.color_code IS 'Takvim/UI için hex veya tailwind uyumlu kod';

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services (id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES public.staff (id) ON DELETE RESTRICT,
  status public.appointment_status NOT NULL DEFAULT 'waiting',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_staff_slot_unique UNIQUE (staff_id, appointment_date, appointment_time)
);

COMMENT ON TABLE public.appointments IS 'Randevular';
COMMENT ON COLUMN public.appointments.appointment_date IS 'Randevu tarihi (modele göre date)';
COMMENT ON COLUMN public.appointments.appointment_time IS 'Randevu saati (modele göre time)';

-- -----------------------------------------------------------------------------
-- updated_at tetikleyicisi
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_updated_at BEFORE
UPDATE ON public.customers FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at ();

CREATE TRIGGER services_updated_at BEFORE
UPDATE ON public.services FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at ();

CREATE TRIGGER staff_updated_at BEFORE
UPDATE ON public.staff FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at ();

CREATE TRIGGER appointments_updated_at BEFORE
UPDATE ON public.appointments FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at ();

-- -----------------------------------------------------------------------------
-- İndeksler
-- -----------------------------------------------------------------------------
CREATE INDEX idx_appointments_date ON public.appointments (appointment_date);

CREATE INDEX idx_appointments_staff_date ON public.appointments (staff_id, appointment_date);

CREATE INDEX idx_appointments_customer ON public.appointments (customer_id);

CREATE INDEX idx_customers_phone ON public.customers (phone);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Oturum açmış kullanıcılar: müşteri / randevu / uzman üzerinde tam yetki
CREATE POLICY "Authenticated full access customers" ON public.customers FOR ALL TO authenticated USING (TRUE)
WITH
  CHECK (TRUE);

CREATE POLICY "Authenticated full access staff" ON public.staff FOR ALL TO authenticated USING (TRUE)
WITH
  CHECK (TRUE);

CREATE POLICY "Authenticated full access appointments" ON public.appointments FOR ALL TO authenticated USING (TRUE)
WITH
  CHECK (TRUE);

-- Hizmetler: herkes fiyat listesi okuyabilir (anon); yönetim oturum gerektirir
CREATE POLICY "Anyone can read services" ON public.services FOR
SELECT
  TO anon USING (TRUE);

CREATE POLICY "Authenticated manage services" ON public.services FOR ALL TO authenticated USING (TRUE)
WITH
  CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- Seed: 2 uzman
-- -----------------------------------------------------------------------------
INSERT INTO
  public.staff (name, color_code)
VALUES
  ('Nova Uzman I', '#F5F1E9'),
  ('Nova Uzman II', '#1A1A1A');
