-- Kullanıcı profili ↔ salon uzmanı eşlemesi (staff rolü izinleri için)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_staff_id ON public.profiles (staff_id);

COMMENT ON COLUMN public.profiles.staff_id IS 'Giriş yapan kullanıcının bağlı olduğu uzman kaydı (staff rolünde randevu/müşteri kapsamı)';
