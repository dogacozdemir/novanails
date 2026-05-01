-- Üretim sıkılaştırma: anonim okuma kapatma (iç panel)

-- Hizmet fiyat listesi yalnızca oturum açmış kullanıcılar için (anon SELECT kaldırılır).
-- Authenticated policy zaten "Authenticated manage services" FOR ALL ile SELECT içerir.
DROP POLICY IF EXISTS "Anyone can read services" ON public.services;

-- Realtime: Randevu tahtasında canlı güncelleme için Supabase Dashboard → Database →
-- Publications → supabase_realtime → “appointments” tablosunu ekleyin.
