-- 1) Tighten profiles UPDATE policy: prevent family_id reassignment
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND family_id = public.get_user_family_id(auth.uid())
);

-- 2) Enforce 2-member cap server-side in join_family_and_create_profile
CREATE OR REPLACE FUNCTION public.join_family_and_create_profile(_code text, _name text)
 RETURNS TABLE(family_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _family_id UUID;
  _profile_id UUID;
  _claimed_count INT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  SELECT id INTO _family_id FROM public.families WHERE code = upper(_code) LIMIT 1;

  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;

  -- Enforce 2-member cap (claimed profiles only — placeholder partner slots can still be claimed)
  SELECT COUNT(*) INTO _claimed_count
  FROM public.profiles
  WHERE public.profiles.family_id = _family_id
    AND claimed_at IS NOT NULL;

  IF _claimed_count >= 2 THEN
    RAISE EXCEPTION 'Family is full';
  END IF;

  INSERT INTO public.profiles (user_id, family_id, name, claimed_at)
  VALUES (_user_id, _family_id, _name, now())
  RETURNING id INTO _profile_id;

  RETURN QUERY SELECT _family_id, _profile_id;
END;
$function$;