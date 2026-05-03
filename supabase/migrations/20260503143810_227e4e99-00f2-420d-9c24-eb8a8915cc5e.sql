DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "insert own profile blocked" ON public.profiles;
CREATE POLICY "insert own profile blocked"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

UPDATE public._app_secrets
SET value = 'c81ac1a6f0315adfc7911979c7cf4501421ea975151b662588a97b6b70595fa2'
WHERE key = 'trigger_secret';

INSERT INTO public._app_secrets (key, value)
SELECT 'trigger_secret', 'c81ac1a6f0315adfc7911979c7cf4501421ea975151b662588a97b6b70595fa2'
WHERE NOT EXISTS (SELECT 1 FROM public._app_secrets WHERE key = 'trigger_secret');

REVOKE EXECUTE ON FUNCTION public.generate_family_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_push_on_tx() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_family_with_two_profiles(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_family_and_profile(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_family_and_create_profile(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_family_profiles_by_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_family_profiles_by_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_profile_to_user(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_profile_settings(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_in_family(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_family_id(uuid) FROM PUBLIC, anon;