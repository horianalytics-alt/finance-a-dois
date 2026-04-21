DROP POLICY IF EXISTS "update own profile" ON public.profiles;

CREATE POLICY "users can claim family profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  family_id = public.get_user_family_id(auth.uid())
  OR user_id = auth.uid()
)
WITH CHECK (
  family_id = public.get_user_family_id(auth.uid())
  OR user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.link_profile_to_user(
  p_profile_id uuid,
  p_user_id uuid,
  p_family_id uuid
)
RETURNS TABLE(family_id uuid, profile_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_user uuid := auth.uid();
  v_profile_family_id uuid;
  v_existing_user_id uuid;
BEGIN
  IF v_auth_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_auth_user THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  SELECT family_id, user_id
    INTO v_profile_family_id, v_existing_user_id
  FROM public.profiles
  WHERE id = p_profile_id;

  IF v_profile_family_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_family_id IS NULL OR p_family_id <> v_profile_family_id THEN
    RAISE EXCEPTION 'Family mismatch';
  END IF;

  IF v_existing_user_id = v_auth_user THEN
    RETURN QUERY SELECT v_profile_family_id, p_profile_id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = v_auth_user
      AND family_id = v_profile_family_id
      AND id <> p_profile_id
  ) THEN
    RAISE EXCEPTION 'You already have a profile in this family';
  END IF;

  UPDATE public.profiles
  SET user_id = v_auth_user,
      updated_at = now()
  WHERE id = p_profile_id
    AND family_id = v_profile_family_id;

  RETURN QUERY SELECT v_profile_family_id, p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_profile_to_user(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_family_profiles_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_family_profiles_by_code(text) TO authenticated;