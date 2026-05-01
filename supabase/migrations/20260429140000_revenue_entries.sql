-- Gelir kayıtları — tamamlanan randevular için ödeme satırı

CREATE TABLE public.revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TRY',
  recorded_at timestamptz NOT NULL DEFAULT now (),
  note text
);

COMMENT ON TABLE public.revenue_entries IS 'Randevu bazlı gelir (Ödeme Al akışı)';

ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access revenue_entries" ON public.revenue_entries FOR ALL TO authenticated USING (TRUE)
WITH
  CHECK (TRUE);
