
DROP FUNCTION IF EXISTS public.link_profile_to_user(uuid, uuid, uuid);

CREATE FUNCTION public.link_profile_to_user(
  p_profile_id uuid,
  p_user_id uuid,
  p_family_id uuid
)
RETURNS TABLE(out_family_id uuid, out_profile_id uuid)
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

  SELECT p.family_id, p.user_id
    INTO v_profile_family_id, v_existing_user_id
  FROM public.profiles p
  WHERE p.id = p_profile_id;

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
    FROM public.profiles pp
    WHERE pp.user_id = v_auth_user
      AND pp.family_id = v_profile_family_id
      AND pp.id <> p_profile_id
  ) THEN
    RAISE EXCEPTION 'You already have a profile in this family';
  END IF;

  UPDATE public.profiles
  SET user_id = v_auth_user,
      updated_at = now()
  WHERE id = p_profile_id
    AND public.profiles.family_id = v_profile_family_id;

  RETURN QUERY SELECT v_profile_family_id, p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_profile_to_user(uuid, uuid, uuid) TO authenticated;
