-- İptal edilen randevular slotu bloke etmez: tam UNIQUE kısıtı yerine
-- yalnızca iptal olmayan satırları kapsayan kısmi benzersiz indeks.
--
-- NOT: Bu dosya canlı veritabanında 2026-05-07'de uygulanmış (public._nova_schema_migrations
-- kaydı mevcut) ancak repoda eksikti. İçerik, 2026-09-23 tarihinde canlı şemadaki indeks
-- tanımından birebir geri kazanılmıştır. Tekrar çalıştırılması güvenlidir.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_staff_slot_unique;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_staff_slot_active_unique ON public.appointments (
  staff_id,
  appointment_date,
  appointment_time
)
WHERE
  status <> 'cancelled'::public.appointment_status;
