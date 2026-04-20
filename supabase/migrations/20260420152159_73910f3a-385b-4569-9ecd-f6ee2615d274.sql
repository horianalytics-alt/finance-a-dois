CREATE OR REPLACE FUNCTION public.count_family_profiles_by_code(_code text)
RETURNS TABLE(family_id uuid, profile_count int, profile_names text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id AS family_id,
    COALESCE(COUNT(p.id), 0)::int AS profile_count,
    COALESCE(ARRAY_AGG(p.name ORDER BY p.created_at) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) AS profile_names
  FROM public.families f
  LEFT JOIN public.profiles p ON p.family_id = f.id
  WHERE f.code = upper(_code)
  GROUP BY f.id
  LIMIT 1
$$;