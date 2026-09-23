-- Tamamlanmış randevularda ödeme düzeltme (yalnızca admin) + değişmez düzeltme geçmişi.
--
-- * payment_corrections: her düzeltmenin eski/yeni tutar, ödeme yöntemi, süre, açıklama,
--   yapan kişi ve zaman kaydı. Yalnızca admin okuyabilir/ekleyebilir; güncelleme ve silme yok.
-- * correct_appointment_payment(): appointments + revenue_entries + payment_corrections
--   güncellemesini TEK transaction içinde yapar (yarım kalan düzeltme olmaz).
--   revenue_entries.recorded_at DEĞİŞMEZ — gelir ilk tahsil edildiği ayda kalır.
--
-- Bağımlılık: public.is_admin() (20260923120000_profiles_rls_admin_only.sql).
-- Mevcut tablolara kolon eklenmez / silinmez; yalnızca yeni nesneler oluşturulur.

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  appointment_id uuid NOT NULL REFERENCES public.appointments (id) ON DELETE CASCADE,
  old_amount numeric(12, 2),
  new_amount numeric(12, 2) NOT NULL CHECK (new_amount >= 0),
  old_payment_method public.payment_method,
  new_payment_method public.payment_method NOT NULL,
  old_actual_duration integer,
  new_actual_duration integer,
  reason text,
  corrected_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  corrected_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payment_corrections IS 'Tamamlanmış randevu ödeme düzeltmelerinin değişmez geçmişi';

CREATE INDEX IF NOT EXISTS idx_payment_corrections_appointment ON public.payment_corrections (appointment_id, created_at DESC);

ALTER TABLE public.payment_corrections ENABLE ROW LEVEL SECURITY;

-- Geçmiş kaydı değiştirilemez / silinemez (randevu kalıcı silinirse CASCADE ile gider).
REVOKE ALL ON public.payment_corrections FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.payment_corrections FROM authenticated;

DROP POLICY IF EXISTS "Admin read payment_corrections" ON public.payment_corrections;
CREATE POLICY "Admin read payment_corrections" ON public.payment_corrections FOR SELECT TO authenticated USING (
  (SELECT public.is_admin ())
);

DROP POLICY IF EXISTS "Admin insert payment_corrections" ON public.payment_corrections;
CREATE POLICY "Admin insert payment_corrections" ON public.payment_corrections FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin ()));

-- -----------------------------------------------------------------------------
-- Ödeme düzeltme fonksiyonu (SECURITY INVOKER — çağıranın RLS yetkileriyle çalışır)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.correct_appointment_payment (
  p_appointment_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_actual_duration integer DEFAULT NULL,
  p_reason text DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_rev public.revenue_entries%ROWTYPE;
  v_has_rev boolean;
  v_amount numeric(12, 2);
  v_duration integer;
  v_reason text;
  v_old_amount numeric(12, 2);
  v_old_method public.payment_method;
BEGIN
  IF NOT public.is_admin () THEN
    RAISE EXCEPTION 'Ödeme düzeltme yalnızca yöneticiler içindir.'
      USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Geçerli bir tutar girin.' USING ERRCODE = '22023';
  END IF;

  IF p_payment_method IS NULL THEN
    RAISE EXCEPTION 'Ödeme yöntemi seçin.' USING ERRCODE = '22023';
  END IF;

  IF p_actual_duration IS NOT NULL AND p_actual_duration <= 0 THEN
    RAISE EXCEPTION 'Gerçekleşen süre pozitif bir tam sayı olmalıdır.' USING ERRCODE = '22023';
  END IF;

  v_amount := round(p_amount, 2);
  v_reason := NULLIF(left(btrim(COALESCE(p_reason, '')), 1000), '');

  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Randevu bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  IF v_appt.status <> 'completed'::public.appointment_status THEN
    RAISE EXCEPTION 'Yalnızca tamamlanmış randevuların ödemesi düzeltilebilir.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_rev
  FROM public.revenue_entries
  WHERE appointment_id = p_appointment_id
  FOR UPDATE;

  v_has_rev := FOUND;

  v_old_amount := CASE WHEN v_has_rev THEN v_rev.amount ELSE v_appt.final_price END;
  v_old_method := CASE WHEN v_has_rev THEN COALESCE(v_rev.payment_method, v_appt.payment_method) ELSE v_appt.payment_method END;
  v_duration := COALESCE(p_actual_duration, v_appt.actual_duration);

  IF v_old_amount IS NOT DISTINCT FROM v_amount
    AND v_old_method IS NOT DISTINCT FROM p_payment_method
    AND v_appt.final_price IS NOT DISTINCT FROM v_amount
    AND v_appt.payment_method IS NOT DISTINCT FROM p_payment_method
    AND v_appt.actual_duration IS NOT DISTINCT FROM v_duration THEN
    RAISE EXCEPTION 'Değişiklik yapılmadı.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.payment_corrections (
    appointment_id,
    old_amount,
    new_amount,
    old_payment_method,
    new_payment_method,
    old_actual_duration,
    new_actual_duration,
    reason,
    corrected_by,
    corrected_by_email
  )
  VALUES (
    p_appointment_id,
    v_old_amount,
    v_amount,
    v_old_method,
    p_payment_method,
    v_appt.actual_duration,
    v_duration,
    v_reason,
    auth.uid (),
    auth.jwt () ->> 'email'
  );

  UPDATE public.appointments
  SET
    final_price = v_amount,
    payment_method = p_payment_method,
    actual_duration = v_duration
  WHERE id = p_appointment_id;

  IF v_has_rev THEN
    UPDATE public.revenue_entries
    SET
      amount = v_amount,
      payment_method = p_payment_method
    WHERE appointment_id = p_appointment_id;
  ELSE
    -- Tamamlanmış ama gelir kaydı olmayan randevu: "İşlemi Bitir" ile aynı davranış.
    INSERT INTO public.revenue_entries (appointment_id, amount, currency, payment_method)
    VALUES (p_appointment_id, v_amount, 'TRY', p_payment_method);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.correct_appointment_payment (uuid, numeric, public.payment_method, integer, text) IS 'Admin: tamamlanmış randevunun ödemesini düzeltir ve geçmişe yazar';

REVOKE ALL ON FUNCTION public.correct_appointment_payment (uuid, numeric, public.payment_method, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.correct_appointment_payment (uuid, numeric, public.payment_method, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.correct_appointment_payment (uuid, numeric, public.payment_method, integer, text) TO authenticated, service_role;

COMMIT;

-- PostgREST şema önbelleğini yenile (yeni fonksiyon /rpc altında hemen görünsün).
NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- GERİ ALMA (gerekirse SQL Editor'de elle çalıştırın — düzeltme geçmişi silinir):
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.correct_appointment_payment (uuid, numeric, public.payment_method, integer, text);
-- DROP TABLE IF EXISTS public.payment_corrections;
-- COMMIT;
-- -----------------------------------------------------------------------------
