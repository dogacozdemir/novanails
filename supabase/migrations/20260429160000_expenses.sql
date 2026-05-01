-- Giderler ve enum kategori

CREATE TYPE public.expense_category AS ENUM (
  'rent',
  'staff',
  'office',
  'food',
  'stationery',
  'supplies',
  'other'
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  expense_date date NOT NULL,
  category public.expense_category NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now ()
);

COMMENT ON TABLE public.expenses IS 'İşletme giderleri';
COMMENT ON COLUMN public.expenses.expense_date IS 'Gider tarihi';

CREATE TRIGGER expenses_updated_at BEFORE
UPDATE ON public.expenses FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at ();

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access expenses" ON public.expenses FOR ALL TO authenticated USING (TRUE)
WITH
  CHECK (TRUE);
