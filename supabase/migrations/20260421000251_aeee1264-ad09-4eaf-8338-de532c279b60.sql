
CREATE OR REPLACE FUNCTION public.list_family_profiles_by_code(_code text)
RETURNS TABLE(family_id uuid, profile_id uuid, profile_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT f.id AS family_id, p.id AS profile_id, p.name AS profile_name
  FROM public.families f
  JOIN public.profiles p ON p.family_id = f.id
  WHERE f.code = upper(_code)
  ORDER BY p.created_at
$$;
