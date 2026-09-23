-- Güvenlik: profiles tablosunda rol yükseltme açığının kapatılması.
--
-- Önceki durum: "Authenticated full access profiles" (FOR ALL USING TRUE) — oturum açmış
-- herhangi bir kullanıcı tarayıcıdan kendi `role` alanını 'admin' yapabiliyordu.
--
-- Yeni durum:
--   * Her kullanıcı yalnızca kendi profil satırını okuyabilir; admin tümünü okuyabilir.
--   * Ekleme / güncelleme / silme yalnızca admin.
--   * Yeni kullanıcı profili auth.users tetikleyicisiyle (SECURITY DEFINER) oluşturulmaya devam eder.
--   * SQL Editor / migration (postgres rolü) RLS'ten etkilenmez.
--
-- Uygulama etkisi: profiles yalnızca middleware ve getSessionProfile içinde, kullanıcının
-- KENDİ satırı için okunur; finans ve izin politikalarındaki alt sorgular da yalnızca
-- kendi satırı (pr.id = auth.uid()) sorgular. Bu nedenle mevcut akışlar değişmez.

BEGIN;

-- Admin kontrolü. SECURITY DEFINER: profiles üzerindeki RLS politikası kendi tablosunu
-- sorgularken sonsuz özyinelemeye girmesin diye tablo sahibi yetkisiyle çalışır.
CREATE OR REPLACE FUNCTION public.is_admin ()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid ())
      AND role = 'admin'::public.user_role
  );
$$;

COMMENT ON FUNCTION public.is_admin () IS 'Oturumdaki kullanıcı admin mi (RLS politikaları için)';

REVOKE ALL ON FUNCTION public.is_admin () FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin () FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin () TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated full access profiles" ON public.profiles;

DROP POLICY IF EXISTS "Profiles select own or admin" ON public.profiles;
CREATE POLICY "Profiles select own or admin" ON public.profiles FOR SELECT TO authenticated USING (
  id = (SELECT auth.uid ())
  OR (SELECT public.is_admin ())
);

DROP POLICY IF EXISTS "Profiles admin insert" ON public.profiles;
CREATE POLICY "Profiles admin insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_admin ()));

DROP POLICY IF EXISTS "Profiles admin update" ON public.profiles;
CREATE POLICY "Profiles admin update" ON public.profiles FOR UPDATE TO authenticated USING (
  (SELECT public.is_admin ())
)
WITH CHECK ((SELECT public.is_admin ()));

DROP POLICY IF EXISTS "Profiles admin delete" ON public.profiles;
CREATE POLICY "Profiles admin delete" ON public.profiles FOR DELETE TO authenticated USING (
  (SELECT public.is_admin ())
);

COMMIT;

-- -----------------------------------------------------------------------------
-- GERİ ALMA (gerekirse SQL Editor'de elle çalıştırın):
--
-- BEGIN;
-- DROP POLICY IF EXISTS "Profiles select own or admin" ON public.profiles;
-- DROP POLICY IF EXISTS "Profiles admin insert" ON public.profiles;
-- DROP POLICY IF EXISTS "Profiles admin update" ON public.profiles;
-- DROP POLICY IF EXISTS "Profiles admin delete" ON public.profiles;
-- CREATE POLICY "Authenticated full access profiles" ON public.profiles FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
-- COMMIT;
--
-- (public.is_admin() fonksiyonu bırakılabilir; payment_corrections politikaları onu kullanır.)
-- -----------------------------------------------------------------------------
