-- İsteğe bağlı: Roller elle atanır (migration ROW_NUMBER yerine sabit kullanıcılar için).
-- Supabase SQL Editor veya psql ile çalıştırın; UUID'leri Dashboard → Authentication'dan değiştirin.
--
-- Örnek:
-- UPDATE public.profiles SET role = 'admin'::public.user_role WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- UPDATE public.profiles SET role = 'staff'::public.user_role WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
--
-- İki kullanıcıyı created_at sırasına göre ata (ilk admin, ikinci staff):
UPDATE public.profiles AS p
SET
  role = v.role
FROM (
  SELECT
    id,
    CASE ROW_NUMBER() OVER (
      ORDER BY
        created_at ASC NULLS LAST,
        id ASC
      )
      WHEN 1 THEN 'admin'::public.user_role
      ELSE 'staff'::public.user_role
    END AS role
  FROM
    auth.users
) AS v
WHERE
  p.id = v.id;
