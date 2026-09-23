-- Personel izin / tatil tablosu ve müşteri arama (trigram) indeksi.
--
-- NOT: Bu dosya canlı veritabanında 2026-05-07'de uygulanmış (public._nova_schema_migrations
-- kaydı mevcut) ancak repoda eksikti. İçerik, 2026-09-23 tarihinde canlı şemadan (tablo,
-- kısıt, indeks, tetikleyici ve RLS politikaları) birebir geri kazanılmıştır.
-- Tüm ifadeler tekrar çalıştırılabilir (IF NOT EXISTS / DROP ... IF EXISTS).

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- -----------------------------------------------------------------------------
-- staff_time_off
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  staff_id uuid NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  type text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_time_off_type_check CHECK (type = ANY (ARRAY['holiday'::text, 'leave'::text])),
  CONSTRAINT staff_time_off_time_order CHECK (start_time < end_time)
);

COMMENT ON TABLE public.staff_time_off IS 'Uzman tatili veya izni; randevu müsaitlik hesabında bloke eder';

CREATE INDEX IF NOT EXISTS idx_staff_time_off_date ON public.staff_time_off (date);

CREATE INDEX IF NOT EXISTS idx_staff_time_off_staff_date ON public.staff_time_off (staff_id, date);

DROP TRIGGER IF EXISTS staff_time_off_updated_at ON public.staff_time_off;

CREATE TRIGGER staff_time_off_updated_at BEFORE
UPDATE ON public.staff_time_off FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

ALTER TABLE public.staff_time_off ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_time_off_admin_all ON public.staff_time_off;

CREATE POLICY staff_time_off_admin_all ON public.staff_time_off FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid ()
      AND pr.role = 'admin'::public.user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid ()
      AND pr.role = 'admin'::public.user_role
  )
);

DROP POLICY IF EXISTS staff_time_off_select_authenticated ON public.staff_time_off;

CREATE POLICY staff_time_off_select_authenticated ON public.staff_time_off FOR SELECT TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- Müşteri arama — ad + soyad + telefon üzerinde trigram GIN indeksi
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_search_gin ON public.customers USING gin (
  ((((name || ' '::text) || surname) || ' '::text) || COALESCE(phone, ''::text)) gin_trgm_ops
);
