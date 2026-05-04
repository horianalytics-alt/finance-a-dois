-- Add claimed_at to track real ownership vs placeholder profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Backfill: any profile whose user_id is set AND who is the only profile for that user
-- is considered already claimed. For families where the creator owns both profiles
-- (placeholder for partner), only the earliest is marked claimed.
WITH ranked AS (
  SELECT id, user_id,
         row_number() OVER (PARTITION BY user_id, family_id ORDER BY created_at) AS rn
  FROM public.profiles
  WHERE user_id IS NOT NULL
)
UPDATE public.profiles p
SET claimed_at = now()
FROM ranked r
WHERE p.id = r.id AND r.rn = 1 AND p.claimed_at IS NULL;

-- Mark newly-created profile as claimed in create_family_and_profile
CREATE OR REPLACE FUNCTION public.create_family_and_profile(_name text)
 RETURNS TABLE(family_id uuid, family_code text, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _family_id UUID;
  _profile_id UUID;
  _code TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  LOOP
    _code := public.generate_family_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families WHERE code = _code);
  END LOOP;

  INSERT INTO public.families (code) VALUES (_code) RETURNING id INTO _family_id;

  INSERT INTO public.profiles (user_id, family_id, name, claimed_at)
  VALUES (_user_id, _family_id, _name, now())
  RETURNING id INTO _profile_id;

  INSERT INTO public.accounts (family_id, name, type, sort_order) VALUES
    (_family_id, 'Conta Corrente', 'corrente', 1),
    (_family_id, 'Cartão Swile', 'beneficio', 2);

  RETURN QUERY SELECT _family_id, _code, _profile_id;
END;
$function$;

-- Mark first profile (creator) as claimed; second (partner placeholder) stays unclaimed
CREATE OR REPLACE FUNCTION public.create_family_with_two_profiles(_name1 text, _name2 text)
 RETURNS TABLE(family_id uuid, family_code text, profile1_id uuid, profile2_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _family_id UUID;
  _p1_id UUID;
  _p2_id UUID;
  _code TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT public.get_user_family_id(_user_id) INTO _family_id;
  IF _family_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta conta já está vinculada a uma família';
  END IF;

  LOOP
    _code := public.generate_family_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families WHERE code = _code);
  END LOOP;

  INSERT INTO public.families (code) VALUES (_code) RETURNING id INTO _family_id;

  INSERT INTO public.profiles (user_id, family_id, name, claimed_at)
  VALUES (_user_id, _family_id, _name1, now())
  RETURNING id INTO _p1_id;

  -- Second profile is a placeholder for the partner; user_id starts as the
  -- creator's id (so they can use the app solo) but claimed_at is NULL so the
  -- real partner can claim it via link_profile_to_user.
  INSERT INTO public.profiles (user_id, family_id, name, claimed_at)
  VALUES (_user_id, _family_id, _name2, NULL)
  RETURNING id INTO _p2_id;

  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Salário', 'receita', 1),
    (_family_id, 'Freelance', 'receita', 2),
    (_family_id, 'Investimentos', 'receita', 3),
    (_family_id, 'Outros', 'receita', 99);

  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Mercado', 'despesa', 1),
    (_family_id, 'Moradia', 'despesa', 2),
    (_family_id, 'Transporte', 'despesa', 3),
    (_family_id, 'Saúde', 'despesa', 4),
    (_family_id, 'Lazer', 'despesa', 5),
    (_family_id, 'Restaurante', 'despesa', 6),
    (_family_id, 'Assinaturas', 'despesa', 7),
    (_family_id, 'Outros', 'despesa', 99);

  INSERT INTO public.categories (family_id, name, type, sort_order) VALUES
    (_family_id, 'Renda Fixa', 'investimento', 1),
    (_family_id, 'Ações', 'investimento', 2),
    (_family_id, 'Fundos', 'investimento', 3),
    (_family_id, 'Cripto', 'investimento', 4),
    (_family_id, 'Outros', 'investimento', 99);

  INSERT INTO public.payment_methods (family_id, name, sort_order) VALUES
    (_family_id, 'Pix', 1),
    (_family_id, 'Débito', 2),
    (_family_id, 'Crédito', 3),
    (_family_id, 'Dinheiro', 4),
    (_family_id, 'Boleto', 5),
    (_family_id, 'Transferência', 6);

  INSERT INTO public.accounts (family_id, name, type, sort_order) VALUES
    (_family_id, 'Conta Corrente', 'corrente', 1),
    (_family_id, 'Cartão Swile', 'beneficio', 2);

  RETURN QUERY SELECT _family_id, _code, _p1_id, _p2_id;
END;
$function$;

-- join_family_and_create_profile: also stamp claimed_at
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

  INSERT INTO public.profiles (user_id, family_id, name, claimed_at)
  VALUES (_user_id, _family_id, _name, now())
  RETURNING id INTO _profile_id;

  RETURN QUERY SELECT _family_id, _profile_id;
END;
$function$;

-- Harden claim_profile: block reassignment of already-claimed profiles
CREATE OR REPLACE FUNCTION public.claim_profile(_profile_id uuid)
 RETURNS TABLE(family_id uuid, profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _family_id uuid;
  _profile_user_id uuid;
  _claimed_at timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.family_id, p.user_id, p.claimed_at
    INTO _family_id, _profile_user_id, _claimed_at
  FROM public.profiles p WHERE p.id = _profile_id;

  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF _profile_user_id = _user_id THEN
    RETURN QUERY SELECT _family_id, _profile_id;
    RETURN;
  END IF;

  -- CRITICAL: a claimed profile can only be re-bound by its real owner
  IF _claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Profile is already owned by another user';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND family_id = _family_id) THEN
    RAISE EXCEPTION 'You already have a profile in this family';
  END IF;

  UPDATE public.profiles
    SET user_id = _user_id, claimed_at = now(), updated_at = now()
    WHERE id = _profile_id;

  RETURN QUERY SELECT _family_id, _profile_id;
END;
$function$;

-- Harden link_profile_to_user: same claimed_at check
CREATE OR REPLACE FUNCTION public.link_profile_to_user(p_profile_id uuid, p_user_id uuid, p_family_id uuid)
 RETURNS TABLE(out_family_id uuid, out_profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user uuid := auth.uid();
  v_profile_family_id uuid;
  v_existing_user_id uuid;
  v_claimed_at timestamptz;
BEGIN
  IF v_auth_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_auth_user THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  SELECT p.family_id, p.user_id, p.claimed_at
    INTO v_profile_family_id, v_existing_user_id, v_claimed_at
  FROM public.profiles p
  WHERE p.id = p_profile_id;

  IF v_profile_family_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_family_id IS NULL OR p_family_id <> v_profile_family_id THEN
    RAISE EXCEPTION 'Family mismatch';
  END IF;

  IF v_existing_user_id = v_auth_user AND v_claimed_at IS NOT NULL THEN
    RETURN QUERY SELECT v_profile_family_id, p_profile_id;
    RETURN;
  END IF;

  -- CRITICAL: if the profile has been claimed by a real user, no one else may take it
  IF v_claimed_at IS NOT NULL AND v_existing_user_id <> v_auth_user THEN
    RAISE EXCEPTION 'Profile is already owned by another user';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles pp
    WHERE pp.user_id = v_auth_user
      AND pp.family_id = v_profile_family_id
      AND pp.id <> p_profile_id
      AND pp.claimed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You already have a profile in this family';
  END IF;

  UPDATE public.profiles
  SET user_id = v_auth_user,
      claimed_at = now(),
      updated_at = now()
  WHERE id = p_profile_id
    AND public.profiles.family_id = v_profile_family_id;

  RETURN QUERY SELECT v_profile_family_id, p_profile_id;
END;
$function$;