-- 0) Remove unique constraint em profiles.user_id (arquitetura Netflix permite 2 perfis na mesma conta)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
DROP INDEX IF EXISTS public.profiles_user_id_key;

-- 1) Adiciona settings em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Realinha profiles órfãos para o user_id do criador da família
WITH primary_users AS (
  SELECT DISTINCT ON (family_id) family_id, user_id
  FROM public.profiles
  ORDER BY family_id, created_at ASC
)
UPDATE public.profiles p
SET user_id = pu.user_id
FROM primary_users pu
WHERE p.family_id = pu.family_id
  AND p.user_id <> pu.user_id;

-- 3) Realinha transações órfãs
WITH primary_users AS (
  SELECT DISTINCT ON (family_id) family_id, user_id
  FROM public.profiles
  ORDER BY family_id, created_at ASC
)
UPDATE public.transactions t
SET user_id = pu.user_id
FROM primary_users pu
WHERE t.family_id = pu.family_id
  AND t.user_id <> pu.user_id;

-- 4) Atualiza get_user_family_id (já com LIMIT 1, mas garante DISTINCT por created_at)
CREATE OR REPLACE FUNCTION public.get_user_family_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT family_id FROM public.profiles WHERE user_id = _user_id ORDER BY created_at ASC LIMIT 1
$function$;

-- 5) RLS de transactions: family-based
DROP POLICY IF EXISTS "insert family transactions" ON public.transactions;
DROP POLICY IF EXISTS "update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "delete own transactions" ON public.transactions;
DROP POLICY IF EXISTS "view family transactions" ON public.transactions;

CREATE POLICY "family can view transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "family can insert transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id = public.get_user_family_id(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "family can update transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "family can delete transactions" ON public.transactions
  FOR DELETE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

-- 6) RLS de push_subscriptions
DROP POLICY IF EXISTS "insert own push subs" ON public.push_subscriptions;
DROP POLICY IF EXISTS "update own push subs" ON public.push_subscriptions;
DROP POLICY IF EXISTS "delete own push subs" ON public.push_subscriptions;

CREATE POLICY "family can insert push subs" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id = public.get_user_family_id(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "family can update push subs" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "family can delete push subs" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (family_id = public.get_user_family_id(auth.uid()));

-- 7) RPC para salvar settings do perfil
CREATE OR REPLACE FUNCTION public.set_profile_settings(_profile_id uuid, _settings jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _family_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT family_id INTO _family_id FROM public.profiles WHERE id = _profile_id;
  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF NOT public.is_in_family(_user_id, _family_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles SET settings = _settings, updated_at = now() WHERE id = _profile_id;
END;
$$;