
CREATE OR REPLACE FUNCTION public.claim_profile(_profile_id uuid)
RETURNS TABLE(family_id uuid, profile_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _family_id uuid;
  _profile_user_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get profile info
  SELECT p.family_id, p.user_id INTO _family_id, _profile_user_id
  FROM public.profiles p WHERE p.id = _profile_id;

  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- If the profile already belongs to this user, just return it
  IF _profile_user_id = _user_id THEN
    RETURN QUERY SELECT _family_id, _profile_id;
    RETURN;
  END IF;

  -- Check caller doesn't already have a profile in this family
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND family_id = _family_id) THEN
    RAISE EXCEPTION 'You already have a profile in this family';
  END IF;

  -- Claim the profile by updating user_id
  UPDATE public.profiles SET user_id = _user_id, updated_at = now() WHERE id = _profile_id;

  RETURN QUERY SELECT _family_id, _profile_id;
END;
$$;
