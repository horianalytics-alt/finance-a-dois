-- 1. Fix profile hijacking: tighten UPDATE RLS to owner only
DROP POLICY IF EXISTS "users can claim family profile" ON public.profiles;

CREATE POLICY "update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Add ownership guards to claim_profile and link_profile_to_user
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
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.family_id, p.user_id INTO _family_id, _profile_user_id
  FROM public.profiles p WHERE p.id = _profile_id;

  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF _profile_user_id = _user_id THEN
    RETURN QUERY SELECT _family_id, _profile_id;
    RETURN;
  END IF;

  -- CRITICAL: prevent hijacking profiles owned by another user
  IF _profile_user_id IS NOT NULL AND _profile_user_id <> _user_id THEN
    RAISE EXCEPTION 'Profile is already owned by another user';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND family_id = _family_id) THEN
    RAISE EXCEPTION 'You already have a profile in this family';
  END IF;

  UPDATE public.profiles SET user_id = _user_id, updated_at = now() WHERE id = _profile_id;

  RETURN QUERY SELECT _family_id, _profile_id;
END;
$function$;

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

  -- CRITICAL: prevent hijacking profiles owned by another user
  IF v_existing_user_id IS NOT NULL AND v_existing_user_id <> v_auth_user THEN
    RAISE EXCEPTION 'Profile is already owned by another user';
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
$function$;

-- 3. Restrict push_subscriptions SELECT to owner only (credentials should not be visible to family)
DROP POLICY IF EXISTS "view family push subs" ON public.push_subscriptions;
CREATE POLICY "view own push subs"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Also tighten UPDATE/DELETE to owner
DROP POLICY IF EXISTS "family can update push subs" ON public.push_subscriptions;
CREATE POLICY "update own push subs"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "family can delete push subs" ON public.push_subscriptions;
CREATE POLICY "delete own push subs"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 4. Restrict storage.objects listing for avatars bucket (prevent enumeration of all avatars)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Public read by direct URL still works because the bucket is public.
-- This policy only restricts SELECT (listing) via the API to the file owner's folder.
CREATE POLICY "Users can list their own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Trigger secret: store random secret in a private table only accessible to service role
CREATE TABLE IF NOT EXISTS public._app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public._app_secrets ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated; service role bypasses RLS.

INSERT INTO public._app_secrets (key, value)
VALUES ('trigger_secret', 'a36375dc0daf0425cb87742dc89f16971ee2fc02822e79d74107c36e9fbf09a4')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Update notify_push_on_tx to send the secret header
CREATE OR REPLACE FUNCTION public.notify_push_on_tx()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _url text := 'https://vsznsyotaonughskoxjl.supabase.co/functions/v1/send-push';
  _payload jsonb;
  _secret text;
BEGIN
  SELECT value INTO _secret FROM public._app_secrets WHERE key = 'trigger_secret';

  _payload := jsonb_build_object(
    'id', NEW.id,
    'family_id', NEW.family_id,
    'profile_id', NEW.profile_id,
    'created_by_id', NEW.created_by_id,
    'description', NEW.description,
    'amount', NEW.amount,
    'type', NEW.type
  );

  PERFORM extensions.http_post(
    url := _url,
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-trigger-secret', COALESCE(_secret, '')
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;