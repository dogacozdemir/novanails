-- Randevu tahtası: anon anahtar ile uzman listesi okunabilir (services ile aynı model).
-- INSERT/UPDATE/DELETE yalnızca authenticated politikasıyla mümkündür.
CREATE POLICY "Anyone can read staff" ON public.staff FOR SELECT TO anon USING (TRUE);
