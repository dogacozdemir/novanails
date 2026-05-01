-- Finans tablolarında geniş "authenticated = tam erişim" politikalarını kaldırır.
-- Admin: revenue_entries + expenses üzerinde tam CRUD.
-- Staff: yalnızca kendi uzmanına atanmış randevunun gelir satırında INSERT/UPDATE/SELECT
--      (Sunucu aksiyonundaki ödeme tamamlama; konsoldan tüm ciro listesi çekilemez.)

DROP POLICY IF EXISTS "Authenticated full access revenue_entries" ON public.revenue_entries;

DROP POLICY IF EXISTS "Authenticated full access expenses" ON public.expenses;

CREATE POLICY "Admin full access revenue_entries"
ON public.revenue_entries
FOR ALL
TO authenticated
USING (
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

CREATE POLICY "Staff insert revenue own appointments"
ON public.revenue_entries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    INNER JOIN public.appointments ap ON ap.id = appointment_id
    WHERE pr.id = auth.uid ()
      AND pr.role = 'staff'::public.user_role
      AND pr.staff_id IS NOT NULL
      AND ap.staff_id = pr.staff_id
  )
);

CREATE POLICY "Staff update revenue own appointments"
ON public.revenue_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    INNER JOIN public.appointments ap ON ap.id = appointment_id
    WHERE pr.id = auth.uid ()
      AND pr.role = 'staff'::public.user_role
      AND pr.staff_id IS NOT NULL
      AND ap.staff_id = pr.staff_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    INNER JOIN public.appointments ap ON ap.id = appointment_id
    WHERE pr.id = auth.uid ()
      AND pr.role = 'staff'::public.user_role
      AND pr.staff_id IS NOT NULL
      AND ap.staff_id = pr.staff_id
  )
);

CREATE POLICY "Staff select revenue own appointments"
ON public.revenue_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles pr
    INNER JOIN public.appointments ap ON ap.id = appointment_id
    WHERE pr.id = auth.uid ()
      AND pr.role = 'staff'::public.user_role
      AND pr.staff_id IS NOT NULL
      AND ap.staff_id = pr.staff_id
  )
);

CREATE POLICY "Admin full access expenses"
ON public.expenses
FOR ALL
TO authenticated
USING (
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
